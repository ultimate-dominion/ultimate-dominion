// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {Items, ConsumableStats, ConsumableStatsData, MagicDamageStats, MagicDamageStatsData, Stats, StatsData, ClassMultipliers} from "@codegen/index.sol";
import { ItemType } from "@codegen/common.sol";
import {CombatMath} from "@libraries/CombatMath.sol";
import {LibChunks} from "@libraries/LibChunks.sol";
import {ATTACK_MODIFIER} from "../../../constants.sol";

/**
 * @title MagicCombat
 * @notice Handles magical attacks using CombatMath and consumable/item stats
 */
contract MagicCombat is System {
    /**
     * @notice Execute a magic attack from attacker to defender with a consumable
     * @param randomNumber entropy for rolls
     * @param attackerId entity id of attacker
     * @param defenderId entity id of defender
     * @param itemId consumable item id with magic damage effect
     * @param effectId effect to apply (for validation/selection of damage profile)
     * @return hit whether the attack hit
     * @return crit whether the attack was a critical hit
     * @return damage computed damage
     */
    function magicAttack(
        uint256 randomNumber,
        bytes32 attackerId,
        bytes32 defenderId,
        uint256 itemId,
        bytes32 effectId
    ) public view returns (bool hit, bool crit, int256 damage) {
        require(Items.getItemType(itemId) == ItemType.Consumable, "MAGIC: Not a consumable");

        AdjustedCombatStats memory attacker = IWorld(_world()).UD__getCombatStats(attackerId);
        AdjustedCombatStats memory defender = IWorld(_world()).UD__getCombatStats(defenderId);

        MagicDamageStatsData memory attackStats = IWorld(_world()).UD__getMagicDamageStats(effectId);
        ConsumableStatsData memory consumable = IWorld(_world()).UD__getConsumableStats(itemId);

        uint64[] memory rnChunks = LibChunks.get4Chunks(randomNumber);
        (hit, crit) = CombatMath.calculateToHit(
            uint256(rnChunks[0]),
            attackStats.attackModifierBonus,
            attackStats.critChanceBonus,
            attacker.intelligence,
            defender.intelligence
        );

        if (hit) {
            int256 base = CombatMath.calculateMagicDamageFromConsumable(
                attackStats, consumable, rnChunks[2], attacker.intelligence, defender.intelligence, crit
            );
            damage = CombatMath.calculateFinalMagicDamage(base, Stats.getCurrentHp(defenderId), Stats.getMaxHp(defenderId), crit);

            // Apply class multipliers (basis points: 1000 = 100%)
            uint256 magicMultiplier = ClassMultipliers.getSpellDamageMultiplier(attackerId);
            if (magicMultiplier > 0) {
                damage = (damage * int256(magicMultiplier)) / 1000;
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


