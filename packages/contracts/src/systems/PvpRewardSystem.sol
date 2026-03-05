// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    AdventureEscrow,
    Stats,
    StatsData,
    Levels
} from "@codegen/index.sol";
import {InvalidRewardState} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
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
        // Losers lose 50% of escrow: 10% burned (permanent sink), 40% to winners
        bytes32[] memory winners = attackersWin ? encounterData.attackers : encounterData.defenders;
        bytes32[] memory losers = attackersWin ? encounterData.defenders : encounterData.attackers;

        for (uint256 i; i < losers.length; i++) {
            uint256 currentBalance = AdventureEscrow.get(losers[i]);
            uint256 toDistribute = currentBalance / PVP_GOLD_DENOMINATOR;
            _goldAmount += toDistribute;
            AdventureEscrow.set(losers[i], (currentBalance - toDistribute));
        }
        // Burn 20% of pot (= 10% of loser escrow), distribute 80% (= 40% of loser escrow)
        uint256 burnAmount = _goldAmount / 5;
        uint256 toWinners = _goldAmount - burnAmount;
        for (uint256 i; i < winners.length; i++) {
            uint256 currentBalance = AdventureEscrow.get(winners[i]);
            AdventureEscrow.set(winners[i], (currentBalance + toWinners / winners.length));
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

            if (currentExp >= maxLevelExp) continue;

            if (currentExp + xpToGrant > maxLevelExp) {
                xpToGrant = maxLevelExp - currentExp;
            }
            winnerStats.experience += xpToGrant;
            _expAmount += xpToGrant;
            Stats.set(winnerId, winnerStats);
        }

        CombatEncounter.setRewardsDistributed(encounterId, true);
    }
}
