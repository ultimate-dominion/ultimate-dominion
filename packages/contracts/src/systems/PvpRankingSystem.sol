// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    PvpRating,
    PvpSeason,
    PvpRatingHistory,
    CharacterZone,
    Admin
} from "@codegen/index.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {
    SeasonNotActive,
    SeasonAlreadyActive,
    NotAdmin
} from "../Errors.sol";
import {
    ELO_DEFAULT_RATING,
    ELO_K_FACTOR,
    ELO_SCALE,
    ZONE_WINDY_PEAKS
} from "../../constants.sol";

/**
 * @title PvpRankingSystem
 * @notice Zone-gated ELO rating. Z2+ PvP updates ratings. DC stays casual.
 */
contract PvpRankingSystem is System {

    event RatingUpdated(bytes32 indexed characterId, int256 newRating, int256 change);
    event SeasonStarted(uint256 season, uint256 seasonEnd);
    event SeasonEnded(uint256 season);

    /**
     * @notice Update ELO ratings for PvP participants. Only called for Z2+ PvP.
     * @param winners Array of winning character IDs
     * @param losers Array of losing character IDs
     */
    function updateRatings(bytes32[] memory winners, bytes32[] memory losers) public {
        _requireSystemOrAdmin(_msgSender());

        // Calculate average ratings for each side
        int256 winnerAvgRating = _getAverageRating(winners);
        int256 loserAvgRating = _getAverageRating(losers);

        // Calculate ELO changes
        (int256 winnerChange, int256 loserChange) = _calculateEloChange(winnerAvgRating, loserAvgRating);

        // Apply to each participant
        uint256 currentSeason = PvpSeason.getCurrentSeason();

        for (uint256 i; i < winners.length; i++) {
            _initializeIfNeeded(winners[i], currentSeason);
            int256 oldRating = PvpRating.getRating(winners[i]);
            int256 newRating = oldRating + winnerChange;
            PvpRating.setRating(winners[i], newRating);
            PvpRating.setWins(winners[i], PvpRating.getWins(winners[i]) + 1);
            emit RatingUpdated(winners[i], newRating, winnerChange);
        }

        for (uint256 i; i < losers.length; i++) {
            _initializeIfNeeded(losers[i], currentSeason);
            int256 oldRating = PvpRating.getRating(losers[i]);
            int256 newRating = oldRating + loserChange;
            if (newRating < 0) newRating = 0; // Floor at 0
            PvpRating.setRating(losers[i], newRating);
            PvpRating.setLosses(losers[i], PvpRating.getLosses(losers[i]) + 1);
            emit RatingUpdated(losers[i], newRating, loserChange);
        }
    }

    /**
     * @notice Check if PvP should be ranked based on zone.
     */
    function isRankedZone(bytes32 characterId) public view returns (bool) {
        return CharacterZone.getZoneId(characterId) >= ZONE_WINDY_PEAKS;
    }

    // ========== Season Management (Admin) ==========

    function startSeason(uint256 seasonEnd) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        uint256 current = PvpSeason.getCurrentSeason();
        if (current > 0 && block.timestamp < PvpSeason.getSeasonEnd()) revert SeasonAlreadyActive();

        uint256 newSeason = current + 1;
        PvpSeason.set(newSeason, block.timestamp, seasonEnd);
        emit SeasonStarted(newSeason, seasonEnd);
    }

    function endSeason() public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        uint256 current = PvpSeason.getCurrentSeason();
        if (current == 0) revert SeasonNotActive();

        // Note: archiving individual ratings to PvpRatingHistory is done via admin script
        // (iterating all characters on-chain is too expensive)
        PvpSeason.setSeasonEnd(block.timestamp);
        emit SeasonEnded(current);
    }

    // ========== Internal ==========

    function _initializeIfNeeded(bytes32 characterId, uint256 currentSeason) internal {
        if (PvpRating.getSeason(characterId) != currentSeason) {
            PvpRating.set(characterId, ELO_DEFAULT_RATING, 0, 0, currentSeason);
        }
    }

    function _getAverageRating(bytes32[] memory characters) internal view returns (int256) {
        if (characters.length == 0) return ELO_DEFAULT_RATING;
        int256 total;
        for (uint256 i; i < characters.length; i++) {
            int256 rating = PvpRating.getRating(characters[i]);
            total += rating == 0 ? ELO_DEFAULT_RATING : rating;
        }
        return total / int256(characters.length);
    }

    /**
     * @notice Linear approximation of ELO expected score calculation.
     *         Avoids exponentiation in Solidity.
     */
    function _calculateEloChange(int256 winnerRating, int256 loserRating)
        internal
        pure
        returns (int256 winnerChange, int256 loserChange)
    {
        int256 diff = loserRating - winnerRating;
        // Clamp to [-400, 400]
        if (diff > ELO_SCALE) diff = ELO_SCALE;
        if (diff < -ELO_SCALE) diff = -ELO_SCALE;

        // Linear approximation: expected = 0.5 + diff / (2 * SCALE)
        // In basis points: expectedBp = 5000 + (diff * 5000 / SCALE)
        int256 expectedBp = 5000 + (diff * 5000 / ELO_SCALE);

        // Change = K * (actual - expected)
        // Winner: actual = 1.0 (10000 bp)
        winnerChange = ELO_K_FACTOR * (10000 - expectedBp) / 10000;
        // Loser: actual = 0.0
        loserChange = -(ELO_K_FACTOR * expectedBp / 10000);
    }
}
