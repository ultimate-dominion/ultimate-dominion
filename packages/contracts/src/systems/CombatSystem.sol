// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Math} from "@libraries/Math.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ArrayManagers} from "@libraries/ArrayManagers.sol";
import {
    RandomNumbers,
    EncounterEntity,
    EncounterEntityData,
    Stats,
    StatsData,
    Actions,
    ActionsData,
    Items,
    CharacterEquipment,
    CharacterEquipmentData,
    CombatEncounter,
    CombatEncounterData,
    CombatOutcome,
    CombatOutcomeData,
    Position,
    Mobs,
    Spawned,
    MobsData,
    Counters,
    ActionOutcome,
    ActionOutcomeData,
    PvPFlag
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
    using Math for uint256;
    using Math for int256;

    function executeAction(ActionOutcomeData memory actionOutcomeData, uint256 randomNumber)
        public
        returns (ActionOutcomeData memory)
    {
        _requireAccess(address(this), _msgSender());
        // if the defender is alive and attacker is alive, execute the action
        if (!getDied(actionOutcomeData.attackerId) && !getDied(actionOutcomeData.defenderId)) {
            // get action data
            ActionsData memory actionData = Actions.get(actionOutcomeData.actionId);

            require(actionData.actionStats.length != 0, "action does not exist");
            //decode action data according to type
            if (uint8(actionData.actionType) == 1) {
                // get attack stats
                PhysicalAttackStats memory attackStats = abi.decode(actionData.actionStats, (PhysicalAttackStats));
                // calculate damage
                (actionOutcomeData.attackerDamageDelt, actionOutcomeData.hit, actionOutcomeData.crit) =
                _calculatePhysicalAttack(
                    attackStats,
                    actionOutcomeData.attackerId,
                    actionOutcomeData.defenderId,
                    actionOutcomeData.weaponId,
                    randomNumber
                );

                // if hit deduct damage
                if (actionOutcomeData.hit) {
                    int256 currentHp = Stats.getCurrentHp(actionOutcomeData.defenderId)
                        - int256(actionOutcomeData.attackerDamageDelt / int256(ATTACK_MODIFIER));
                    if (currentHp <= 0) actionOutcomeData.defenderDied = true;
                    Stats.setCurrentHp(actionOutcomeData.defenderId, currentHp);
                } else {
                    actionOutcomeData.miss = true;
                }
            } else {
                revert("action type not recognized");
            }

            if (actionOutcomeData.defenderDied) {
                EncounterEntity.setDied(actionOutcomeData.defenderId, true);
            }
            if (actionOutcomeData.attackerDied) {
                EncounterEntity.setDied(actionOutcomeData.attackerId, true);
            }
        }
        return actionOutcomeData;
    }

    function getDied(bytes32 entityId) public view returns (bool isDied) {
        return EncounterEntity.getDied(entityId);
    }

    function getEncounter(bytes32 encounterId) public view returns (CombatEncounterData memory) {
        return CombatEncounter.get(encounterId);
    }

    function _getCurrentActionData(Action memory currentAction)
        internal
        view
        returns (ActionOutcomeData memory currentActionData)
    {
        currentActionData = ActionOutcomeData({
            actionId: currentAction.actionId,
            weaponId: currentAction.weaponId,
            attackerId: currentAction.attackerEntityId,
            defenderId: currentAction.defenderEntityId,
            hit: false,
            miss: false,
            crit: false,
            attackerDamageDelt: 0,
            defenderDamageDelt: 0,
            attackerDied: false,
            defenderDied: false,
            blockNumber: block.number,
            timestamp: block.timestamp
        });
    }

    function _calculatePhysicalAttack(
        PhysicalAttackStats memory attackStats,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 weaponId,
        uint256 randomNumber
    ) internal view returns (int256 damage, bool hit, bool crit) {
        // get attacker
        AdjustedCombatStats memory attacker = IWorld(_world()).UD__applyEquipmentBonuses(attackerId);
        //get defender
        AdjustedCombatStats memory defender = IWorld(_world()).UD__applyEquipmentBonuses(defenderId);
        // get weapon stats
        WeaponStats memory weapon = IWorld(_world()).UD__getWeaponStats(weaponId);

        if (defender.currentHp > 0) {
            uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
            (hit, crit) = _calculatePhysicalAttackModifier(
                uint256(rnChunks[0]), uint256(rnChunks[1]), attackStats, attacker, defender
            );

            if (hit) {
                damage = (
                    (
                        attackStats.bonusDamage
                            + int256(
                                uint256(rnChunks[2]) % weapon.maxDamage <= weapon.minDamage
                                    ? weapon.minDamage
                                    : uint256(rnChunks[2]) % weapon.maxDamage
                            ) + int256(attacker.adjustedStrength / 4)
                    ) * int256(ATTACK_MODIFIER)
                )
                    - int256(
                        (
                            int256(defender.adjustedArmor) - attackStats.armorPenetration > 0
                                ? uint256(int256(defender.adjustedArmor) - attackStats.armorPenetration)
                                : uint256(1)
                        ) * DEFENSE_MODIFIER
                    );
                if (crit) {
                    console2.log("CRIT!");
                    damage = damage * int256(CRIT_MODIFIER);
                    crit = true;
                }
            } else {
                console2.log("MISS!");
                damage = 0;
                hit = false;
            }
        } else {
            damage = 0;
            hit = false;
            crit = false;
        }
    }

    function _calculatePhysicalAttackModifier(
        uint256 attackRoll,
        uint256 defenseRoll,
        PhysicalAttackStats memory attackStats,
        AdjustedCombatStats memory attacker,
        AdjustedCombatStats memory defender
    ) internal view returns (bool attackLands, bool crit) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        uint256 attackTotal = (Math.add(attacker.adjustedAgility, attackStats.attackModifierBonus) + (attackRoll % 100))
            * (TO_HIT_MODIFIER);
        // attacker.agility + attackStats.attackModifierBonus + attackRoll * TO_HIT_MODIFIER

        uint256 defenseTotal = ((defenseRoll % 100) + defender.adjustedAgility) * DEFENSE_MODIFIER;
        attackLands = attackTotal > defenseTotal;

        if (attackLands) {
            crit = attackTotal / defenseTotal >= 2;
        }
    }

    function _calculateMagicAttack() public {}
}
