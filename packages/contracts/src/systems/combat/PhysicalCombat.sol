// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {Items, WeaponStats, WeaponStatsData, PhysicalDamageStats, PhysicalDamageStatsData, Stats, StatsData, ClassMultipliers} from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {CombatMath} from "@libraries/CombatMath.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ATTACK_MODIFIER} from "../../../constants.sol";

/**
 * @title PhysicalCombat
 * @notice Handles physical attacks using CombatMath and weapon stats
 */
contract PhysicalCombat is System {
    /**
     * @notice Execute a physical attack from attacker to defender with a weapon
     * @param randomNumber entropy for rolls
     * @param attackerId entity id of attacker
     * @param defenderId entity id of defender
     * @param itemId weapon item id
     * @param effectId effect to apply (for validation/selection of damage profile)
     * @return hit whether the attack hit
     * @return crit whether the attack was a critical hit
     * @return damage computed damage
     */
    function physicalAttack(
        uint256 randomNumber,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 itemId,
        bytes32 effectId
    ) public view returns (bool hit, bool crit, int256 damage) {
        require(Items.getItemType(itemId) == ItemType.Weapon, "PHYS: Not a weapon");

        AdjustedCombatStats memory attacker = IWorld(_world()).UD__getCombatStats(attackerId);
        AdjustedCombatStats memory defender = IWorld(_world()).UD__getCombatStats(defenderId);

        PhysicalDamageStatsData memory attackStats = IWorld(_world()).UD__getPhysicalDamageStats(effectId);
        WeaponStatsData memory weapon = IWorld(_world()).UD__getWeaponStats(itemId);

        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
        (hit, crit) = CombatMath.calculateToHit(
            uint256(rnChunks[0]),
            attackStats.attackModifierBonus,
            attackStats.critChanceBonus,
            attacker.strength,
            defender.agility
        );

        if (hit) {
            int256 base = CombatMath.calculateWeaponDamage(
                attackStats, attacker.strength, defender.strength, weapon, rnChunks[2], crit, ATTACK_MODIFIER
            );
            // ±25% damage variance so hits don't feel static
            base = CombatMath.applyDamageVariance(base, rnChunks[1]);
            damage = CombatMath.calculateFinalPhysicalDamage(base, defender.armor, attackStats.armorPenetration, crit);

            // Apply class multipliers (basis points: 1000 = 100%)
            uint256 physicalMultiplier = ClassMultipliers.getPhysicalDamageMultiplier(attackerId);
            if (physicalMultiplier > 0) {
                damage = (damage * int256(physicalMultiplier)) / 1000;
            }

            // Apply crit damage multiplier if critical hit
            if (crit) {
                uint256 critMultiplier = ClassMultipliers.getCritDamageMultiplier(attackerId);
                if (critMultiplier > 1000) { // Only apply if above base
                    damage = (damage * int256(critMultiplier)) / 1000;
                }
            }

            if (damage < 1) damage = 1;
        }
    }
}


