// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    RandomNumbers,
    MatchEntity,
    Stats,
    StatsData,
    Skills,
    SkillsData,
    CharacterEquipment,
    CharacterEquipmentData
} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment, EncounterType} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {CombatEncounter, CombatEncounterData} from "@tables/CombatEncounter.sol";
import {MonsterStats, WeaponStats, NPCStats, CombatMove, PhysicalAttackStats} from "@interfaces/Structs.sol";
import {_requireOwner} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {IRngSystem} from "../interfaces/IRngSystem.sol";
import {DEFAULT_MAX_TURNS, TO_HIT_MODIFIER, DEFENSE_MODIFIER, ATTACK_MODIFIER} from "../../constants.sol";

contract CombatSystem is System {
    // in pve the attackers are always players and the defenders are always mobs since there is no aggro system
    function createMatch(EncounterType encounterType, bytes32[] memory attackers, bytes32[] memory defenders)
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
        if (uint8(encounterType) == 0) {
            for (uint256 i; i < defenders.length; i++) {
                require(MatchEntity.getEncounterId(defenders[i]).length == 0, "COMBAT: Entity Already engaged");
                MatchEntity.setEncounterId(defenders[i], encounterId);
            }
        }

        return encounterId;
    }
    /**
     * @param encounterId the bytes32 id of the encounter
     * @param moves for a pve encounter player moves are calculated first and the mobs.
     */

    function endTurn(bytes32 encounterId, CombatMove[] memory moves) public {
        CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
        require(encounterData.currentTurn < encounterData.maxTurns, "this encounter is over");

        _queueActions(encounterId, moves);
    }

    function executeCombat(uint256 randomNumber, bytes32 encounterId, CombatMove[] memory moves) public {
        // ensure this is an authorised call
        // _requireAccess(address(this), _msgSender());

        //get encounter data

        for (uint256 i; i < moves.length; i++) {
            CombatMove memory currentMove = moves[i];

            _executeAttack(
                encounterId,
                currentMove.skillId,
                currentMove.attackerEntityId,
                currentMove.defenderEntityId,
                currentMove.weaponId,
                randomNumber
            );
        }
    }

    function _queueActions(bytes32 encounterId, CombatMove[] memory moves) internal {
        SystemSwitch.call(
            abi.encodeCall(IRngSystem.getRng, (encounterId, RngRequestType.Combat, abi.encode(encounterId, moves)))
        );
    }

    function _executeAttack(
        bytes32 matchEntity,
        bytes32 skillId,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) internal {
        // get skill data
        SkillsData memory skillData = Skills.get(skillId);
        //TODO figure out how many chunks to get and distribute those chunks
        //decode skill data according to type
        if (uint8(skillData.skillType) == 1) {
            PhysicalAttackStats memory attackStats = abi.decode(skillData.skillStats, (PhysicalAttackStats));
            uint256 damage = _calculatePhysicalAttack(attackStats, attackerId, defenderId, weaponId, randomNumber);
        }
        //calculate damage
    }

    function _calculatePhysicalAttack(
        PhysicalAttackStats memory attackStats,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) public returns (uint256 damage) {
        // get attacker
        StatsData memory attacker = applyEquipmentBonuses(attackerId);
        //get defender
        StatsData memory defender = applyEquipmentBonuses(defenderId);
        // get weapon stats
        WeaponStats memory weapon = IWorld(_world()).UD__getWeaponStats(weaponId);
        if (_calculatePhysicalAttackModifier(randomNumber, attacker.agility, defender.agility)) {
            damage = (
                attackStats.bonusDamage
                    + (randomNumber % weapon.maxDamage == 0 ? weapon.minDamage : randomNumber % weapon.maxDamage + 1)
            ) * (attacker.strength * ATTACK_MODIFIER) - defender.armor;
        } else {
            damage = 0;
        }
    }

    function _calculatePhysicalAttackModifier(uint256 attackRoll, uint256 attackerAgi, uint256 defenderAgi)
        internal
        returns (bool attackLands)
    {
        attackLands = (attackRoll + (attackerAgi * TO_HIT_MODIFIER)) >= (defenderAgi * DEFENSE_MODIFIER);
    }

    function applyEquipmentBonuses(bytes32 entityId) public view returns (StatsData memory modifiedStats) {
        StatsData memory entityStats = Stats.get(entityId);
        CharacterEquipmentData memory equipmentStats = CharacterEquipment.get(entityId);
        //TODO add over/underflowProtection
        entityStats.strength = uint256(
            int256(entityStats.strength) + equipmentStats.strBonus >= 0
                ? int256(entityStats.strength) + equipmentStats.strBonus
                : int256(1)
        );
        entityStats.agility = uint256(
            int256(entityStats.agility) + equipmentStats.agiBonus >= 0
                ? int256(entityStats.agility) + equipmentStats.agiBonus
                : int256(1)
        );
        entityStats.intelligence = uint256(
            int256(entityStats.intelligence) + equipmentStats.intBonus >= 0
                ? int256(entityStats.intelligence) + equipmentStats.intBonus
                : int256(1)
        );
        entityStats.maxHitPoints = uint256(
            int256(entityStats.maxHitPoints) + equipmentStats.hpBonus >= 0
                ? int256(entityStats.maxHitPoints) + equipmentStats.hpBonus
                : int256(0)
        );
        return entityStats;
    }

    function _calculateMagicAttack() public {}
}
