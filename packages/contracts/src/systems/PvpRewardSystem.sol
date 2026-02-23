// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    CombatEncounter,
    CombatEncounterData,
    EncounterEntity,
    AdventureEscrow
} from "@codegen/index.sol";
import {InvalidRewardState} from "../Errors.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {PVP_GOLD_DENOMINATOR} from "../../constants.sol";

contract PvpRewardSystem is System {
    function distributePvpRewards(bytes32 encounterId, uint256 randomNumber)
        public
        returns (uint256 _expAmount, uint256 _goldAmount, uint256[] memory _itemIdsDropped)
    {
        _requireSystemOrAdmin(_msgSender(), _world());
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        if (encounterData.end == 0 || encounterData.rewardsDistributed) revert InvalidRewardState();

        bool attackersWin;
        uint256 deadDefenders;
        for (uint256 i; i < encounterData.defenders.length; i++) {
            if (EncounterEntity.getDied(encounterData.defenders[i])) deadDefenders++;
        }
        if (deadDefenders == encounterData.defenders.length) attackersWin = true;

        if (attackersWin) {
            for (uint256 i; i < encounterData.defenders.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.defenders[i]);
                uint256 toDistribute = currentBalance / PVP_GOLD_DENOMINATOR;
                _goldAmount += toDistribute;
                AdventureEscrow.set(encounterData.defenders[i], (currentBalance - toDistribute));
            }
            for (uint256 i; i < encounterData.attackers.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.attackers[i]);
                uint256 toDistribute = _goldAmount / encounterData.attackers.length;
                AdventureEscrow.set(encounterData.attackers[i], (currentBalance + toDistribute));
            }
        } else {
            for (uint256 i; i < encounterData.attackers.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.attackers[i]);
                uint256 toDistribute = currentBalance / PVP_GOLD_DENOMINATOR;
                _goldAmount += toDistribute;
                AdventureEscrow.set(encounterData.attackers[i], (currentBalance - toDistribute));
            }
            for (uint256 i; i < encounterData.defenders.length; i++) {
                uint256 currentBalance = AdventureEscrow.get(encounterData.defenders[i]);
                uint256 toDistribute = _goldAmount / encounterData.defenders.length;
                AdventureEscrow.set(encounterData.defenders[i], (currentBalance + toDistribute));
            }
        }
    }
}
