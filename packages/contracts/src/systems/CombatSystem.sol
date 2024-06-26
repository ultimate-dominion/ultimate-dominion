// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {
    RandomNumbers,
    MatchEntity,
    Stats,
    StatsData,
    Actions,
    ActionsData,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    Position,
    Mobs,
    MobsData,
    Counters
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {
    MonsterStats,
    WeaponStats,
    NPCStats,
    Action,
    PhysicalAttackStats,
    AdjustedCombatStats
} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {
    DEFAULT_MAX_TURNS,
    TO_HIT_MODIFIER,
    DEFENSE_MODIFIER,
    ATTACK_MODIFIER,
    CRIT_MODIFIER,
    BASE_GOLD_DROP
} from "../../constants.sol";
import "forge-std/console2.sol";

contract CombatSystem is System {
    // in pvp the attackers are always players and the defenders are always mobs since there is no aggro system
    function createMatch(EncounterType encounterType, bytes32[] memory attackers, bytes32[] memory defenders)
        public
        returns (bytes32 encounterId)
    {
        require(isParticipant(_msgSender(), attackers), "COMBAT SYSTEM: INVALID SENDER");
        (uint16 x, uint16 y) = Position.get(attackers[0]);

        if (uint256(encounterType) == 1) {
            require(isValidPvE(attackers, defenders, x, y), "COMBAT SYSTEM: INVALID PVE");
            uint256 startTime = block.timestamp;
            encounterId = keccak256(abi.encode(encounterType, attackers, defenders, startTime));
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
        }
        if (uint8(encounterType) == 0) {}
        for (uint256 i; i < defenders.length; i++) {
            require(MatchEntity.getEncounterId(defenders[i]) == bytes32(0), "COMBAT SYSTEM: ENTITY OCCUPIED");
            MatchEntity.setEncounterId(defenders[i], encounterId);
        }
        for (uint256 i; i < attackers.length; i++) {
            require(MatchEntity.getEncounterId(attackers[i]) == bytes32(0), "COMBAT SYSTEM: ENTITY OCCUPIED");
            MatchEntity.setEncounterId(attackers[i], encounterId);
        }
    }
}
