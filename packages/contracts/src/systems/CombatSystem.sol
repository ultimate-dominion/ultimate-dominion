// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {CombatEncounter, CombatEncounterData} from "@tables/CombatEncounter.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract CombatSystem is System {
    // in pvp the attackers are always players and the defenders are always mobs since there is no aggro system
    function createMatch(EncounterType encounterType, uint256[] memory attackers, bytes32[] memory defenders)
        public
        returns (bytes32)
    {
        uint256 startTime = block.timestamp;
        bytes32 encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));
        CombatEncounterData memory combatData = CombatEncounterData({
            encounterType: encounterType,
            start: startTime,
            end: 0,
            currentTurn: 0,
            maxTurns: DEFAULT_MAX_TURNS,
            defenders: defenders,
            attackers: attackers
        });
        CombatEncounter.set(encounterId, combatData);
        return encounterId;
    }

    function createSkill() public returns (uint256) {}
}
