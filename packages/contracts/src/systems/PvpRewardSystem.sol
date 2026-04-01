// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    Stats,
    StatsData,
    Levels
} from "@codegen/index.sol";
import {InvalidRewardState} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {PVP_GOLD_DENOMINATOR, PVP_BASE_XP, MAX_LEVEL} from "../../constants.sol";

contract PvpRewardSystem is System {
    function distributePvpRewards(bytes32 encounterId, uint256 randomNumber)
        public
        returns (uint256 _expAmount, uint256 _goldAmount, uint256[] memory _itemIdsDropped)
    {
        _requireSystemOrAdmin(_msgSender());
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        if (encounterData.end == 0 || encounterData.rewardsDistributed) revert InvalidRewardState();

        bool attackersWin;
        uint256 deadDefenders;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (EncounterEntity.getDied(encounterData.defenders[i])) deadDefenders++;
        }
        if (deadDefenders == encounterData.defenders.length) attackersWin = true;

        // --- Gold redistribution ---
        // Losers lose 25% of on-hand Gold: 15% burned (permanent sink), 10% to winners
        bytes32[] memory winners = attackersWin ? encounterData.attackers : encounterData.defenders;
        bytes32[] memory losers = attackersWin ? encounterData.defenders : encounterData.attackers;

        for (uint256 i; i < losers.length; i++) {
            address loserAddr = IWorld(_world()).UD__getOwnerAddress(losers[i]);
            uint256 walletGold = GoldLib.goldBalanceOf(loserAddr);
            if (walletGold == 0) continue;

            uint256 totalLoss = walletGold / PVP_GOLD_DENOMINATOR; // 25% of on-hand gold
            if (totalLoss == 0) continue;

            uint256 burnAmount = totalLoss * 3 / 5; // 60% of pot = 15% of wallet (burned)
            uint256 toWinners = totalLoss - burnAmount; // 40% of pot = 10% of wallet (to killer)
            _goldAmount += totalLoss;

            GoldLib.goldBurn(_world(), loserAddr, burnAmount);

            uint256 perWinner = toWinners / winners.length;
            for (uint256 j; j < winners.length; j++) {
                address winnerAddr = IWorld(_world()).UD__getOwnerAddress(winners[j]);
                GoldLib.goldTransfer(_world(), loserAddr, winnerAddr, perWinner);
            }
            // Burn any rounding dust so loser loses exactly totalLoss
            uint256 dust = toWinners - perWinner * winners.length;
            if (dust > 0) GoldLib.goldBurn(_world(), loserAddr, dust);
        }

        // --- XP rewards for winners ---
        // Calculate base XP from defeated players: sum of (level^2 * PVP_BASE_XP)
        uint256 baseExp;
        for (uint256 i; i < losers.length; i++) {
            uint256 loserLevel = Stats.getLevel(losers[i]);
            if (loserLevel == 0) loserLevel = 1;
            baseExp += loserLevel * loserLevel * PVP_BASE_XP;
        }

        uint256 maxLevelExp = Levels.get(MAX_LEVEL);
        uint256 livingWinners;
        for (uint256 i; i < winners.length; i++) {
            if (!EncounterEntity.getDied(winners[i])) livingWinners++;
        }
        if (livingWinners == 0) livingWinners = 1;

        for (uint256 i; i < winners.length; i++) {
            bytes32 winnerId = winners[i];
            if (EncounterEntity.getDied(winnerId)) continue;

            StatsData memory winnerStats = Stats.get(winnerId);
            uint256 currentExp = winnerStats.experience;
            uint256 xpToGrant = baseExp / livingWinners;

            if (winnerStats.level >= MAX_LEVEL || currentExp >= maxLevelExp) continue;

            if (currentExp + xpToGrant > maxLevelExp) {
                xpToGrant = maxLevelExp - currentExp;
            }
            winnerStats.experience += xpToGrant;
            _expAmount += xpToGrant;
            Stats.set(winnerId, winnerStats);
        }

        CombatEncounter.setRewardsDistributed(encounterId, true);

        // Update PvP ratings for Z2+ zones (gas-guarded)
        if (gasleft() > 50_000 && winners.length > 0 && losers.length > 0) {
            // Check zone of first winner — all participants should be in same zone
            try IWorld(_world()).UD__isRankedZone(winners[0]) returns (bool isRanked) {
                if (isRanked) {
                    try IWorld(_world()).UD__updateRatings(winners, losers) {} catch {}
                }
            } catch {}
        }
    }
}
