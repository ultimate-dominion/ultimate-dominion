// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    Effects,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    AdvancedClassItems
} from "@codegen/index.sol";
import {EffectType, AdvancedClass, ItemType, ResistanceStat} from "@codegen/common.sol";

import "forge-std/StdJson.sol";

/**
 * @title DeployClassSpells
 * @notice Deploys 9 class spell effects, creates 9 class spell weapon items,
 *         and populates AdvancedClassItems table.
 *
 * Prerequisites:
 * - World must be deployed
 * - DeployEffects must have run (for existing effects)
 *
 * Usage:
 *   forge script DeployClassSpells --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployClassSpells is Script {
    IWorld public world;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployClassSpells ===");

        // Step 1: Deploy new effects
        _deployEffects();

        // Step 2: Create 9 class spell items and link to AdvancedClassItems
        _createClassSpellItems();

        vm.stopBroadcast();

        console.log("=== DeployClassSpells Complete ===");
    }

    function _deployEffects() internal {
        console.log("Deploying class spell effects...");

        // === Magic Damage Effects ===

        // arcane_surge_damage
        bytes32 arcaneSurgeDmg = bytes32(bytes8(keccak256(abi.encode("arcane_surge_damage"))));
        MagicDamageStats.set(arcaneSurgeDmg, MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 2,
            critChanceBonus: 1
        }));
        Effects.set(arcaneSurgeDmg, EffectType.MagicDamage, true);
        console.log("  arcane_surge_damage deployed");

        // soul_drain_damage
        bytes32 soulDrainDmg = bytes32(bytes8(keccak256(abi.encode("soul_drain_damage"))));
        MagicDamageStats.set(soulDrainDmg, MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 1,
            critChanceBonus: 0
        }));
        Effects.set(soulDrainDmg, EffectType.MagicDamage, true);
        console.log("  soul_drain_damage deployed");

        // arcane_blast_damage
        bytes32 arcaneBlastDmg = bytes32(bytes8(keccak256(abi.encode("arcane_blast_damage"))));
        MagicDamageStats.set(arcaneBlastDmg, MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 3,
            critChanceBonus: 2
        }));
        Effects.set(arcaneBlastDmg, EffectType.MagicDamage, true);
        console.log("  arcane_blast_damage deployed");

        // === Status Effects ===

        // battle_cry (Warrior) - self-buff: +4 STR, +3 armor, 3 turns
        bytes32 battleCry = bytes32(bytes8(keccak256(abi.encode("battle_cry"))));
        StatusEffectStats.set(battleCry, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 3, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 4
        }));
        StatusEffectTargeting.set(battleCry, true);
        StatusEffectValidity.set(battleCry, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));
        Effects.set(battleCry, EffectType.StatusEffect, true);
        console.log("  battle_cry deployed");

        // divine_shield (Paladin) - self-buff: +5 armor, +3 STR, 3 turns
        bytes32 divineShield = bytes32(bytes8(keccak256(abi.encode("divine_shield"))));
        StatusEffectStats.set(divineShield, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 5, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 3
        }));
        StatusEffectTargeting.set(divineShield, true);
        StatusEffectValidity.set(divineShield, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));
        Effects.set(divineShield, EffectType.StatusEffect, true);
        console.log("  divine_shield deployed");

        // hunters_mark (Ranger) - debuff: -5 AGI, -2 armor, 4 turns
        bytes32 huntersMark = bytes32(bytes8(keccak256(abi.encode("hunters_mark"))));
        StatusEffectStats.set(huntersMark, StatusEffectStatsData({
            agiModifier: -5, armorModifier: -2, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: 0
        }));
        StatusEffectTargeting.set(huntersMark, false);
        StatusEffectValidity.set(huntersMark, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 4
        }));
        Effects.set(huntersMark, EffectType.StatusEffect, true);
        console.log("  hunters_mark deployed");

        // shadowstep (Rogue) - self-buff: +8 AGI, 2 turns
        bytes32 shadowstep = bytes32(bytes8(keccak256(abi.encode("shadowstep"))));
        StatusEffectStats.set(shadowstep, StatusEffectStatsData({
            agiModifier: 8, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(shadowstep, true);
        StatusEffectValidity.set(shadowstep, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 2
        }));
        Effects.set(shadowstep, EffectType.StatusEffect, true);
        console.log("  shadowstep deployed");

        // entangle (Druid) - debuff: -5 AGI, -3 STR, 3 turns
        bytes32 entangle = bytes32(bytes8(keccak256(abi.encode("entangle"))));
        StatusEffectStats.set(entangle, StatusEffectStatsData({
            agiModifier: -5, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: -3
        }));
        StatusEffectTargeting.set(entangle, false);
        StatusEffectValidity.set(entangle, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));
        Effects.set(entangle, EffectType.StatusEffect, true);
        console.log("  entangle deployed");

        // soul_drain_curse (Warlock) - debuff: -3 STR, -3 INT, 3 turns
        bytes32 soulDrainCurse = bytes32(bytes8(keccak256(abi.encode("soul_drain_curse"))));
        StatusEffectStats.set(soulDrainCurse, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: -3, resistanceStat: ResistanceStat.Intelligence,
            strModifier: -3
        }));
        StatusEffectTargeting.set(soulDrainCurse, false);
        StatusEffectValidity.set(soulDrainCurse, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));
        Effects.set(soulDrainCurse, EffectType.StatusEffect, true);
        console.log("  soul_drain_curse deployed");

        // blessing (Cleric) - self-buff: +3 INT, +5 armor, +5 maxHp, 3 turns
        bytes32 blessing = bytes32(bytes8(keccak256(abi.encode("blessing"))));
        StatusEffectStats.set(blessing, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 5, damagePerTick: 0,
            hpModifier: 5, intModifier: 3, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(blessing, true);
        StatusEffectValidity.set(blessing, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 3
        }));
        Effects.set(blessing, EffectType.StatusEffect, true);
        console.log("  blessing deployed");

        console.log("All class spell effects deployed");
    }

    function _createClassSpellItems() internal {
        console.log("Creating class spell items...");

        // Effect IDs
        bytes32 battleCryId = bytes32(bytes8(keccak256(abi.encode("battle_cry"))));
        bytes32 divineShieldId = bytes32(bytes8(keccak256(abi.encode("divine_shield"))));
        bytes32 arcaneSurgeDmgId = bytes32(bytes8(keccak256(abi.encode("arcane_surge_damage"))));
        bytes32 huntersMarkId = bytes32(bytes8(keccak256(abi.encode("hunters_mark"))));
        bytes32 shadowstepId = bytes32(bytes8(keccak256(abi.encode("shadowstep"))));
        bytes32 entangleId = bytes32(bytes8(keccak256(abi.encode("entangle"))));
        bytes32 soulDrainDmgId = bytes32(bytes8(keccak256(abi.encode("soul_drain_damage"))));
        bytes32 soulDrainCurseId = bytes32(bytes8(keccak256(abi.encode("soul_drain_curse"))));
        bytes32 arcaneBlastDmgId = bytes32(bytes8(keccak256(abi.encode("arcane_blast_damage"))));
        bytes32 blessingId = bytes32(bytes8(keccak256(abi.encode("blessing"))));

        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minAgility: 0, minIntelligence: 0, minStrength: 0
        });

        // 1. Battle Cry (Warrior) - status effect only, no damage
        bytes32[] memory battleCryEffects = new bytes32[](1);
        battleCryEffects[0] = battleCryId;
        uint256 battleCryItemId = _createSpellWeapon(
            "spell:battle_cry", 0, 0, 10, battleCryEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Warrior, battleCryItemId);
        console.log("  Battle Cry (Warrior) itemId:", battleCryItemId);

        // 2. Divine Shield (Paladin) - status effect only, no damage
        bytes32[] memory divineShieldEffects = new bytes32[](1);
        divineShieldEffects[0] = divineShieldId;
        uint256 divineShieldItemId = _createSpellWeapon(
            "spell:divine_shield", 0, 0, 10, divineShieldEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Paladin, divineShieldItemId);
        console.log("  Divine Shield (Paladin) itemId:", divineShieldItemId);

        // 3. Arcane Surge (Sorcerer) - magic damage 10-16
        bytes32[] memory arcaneSurgeEffects = new bytes32[](1);
        arcaneSurgeEffects[0] = arcaneSurgeDmgId;
        uint256 arcaneSurgeItemId = _createSpellWeapon(
            "spell:arcane_surge", 10, 16, 10, arcaneSurgeEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Sorcerer, arcaneSurgeItemId);
        console.log("  Arcane Surge (Sorcerer) itemId:", arcaneSurgeItemId);

        // 4. Hunter's Mark (Ranger) - status effect only, no damage
        bytes32[] memory huntersMarkEffects = new bytes32[](1);
        huntersMarkEffects[0] = huntersMarkId;
        uint256 huntersMarkItemId = _createSpellWeapon(
            "spell:hunters_mark", 0, 0, 10, huntersMarkEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Ranger, huntersMarkItemId);
        console.log("  Hunter's Mark (Ranger) itemId:", huntersMarkItemId);

        // 5. Shadowstep (Rogue) - status effect only, no damage
        bytes32[] memory shadowstepEffects = new bytes32[](1);
        shadowstepEffects[0] = shadowstepId;
        uint256 shadowstepItemId = _createSpellWeapon(
            "spell:shadowstep", 0, 0, 10, shadowstepEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Rogue, shadowstepItemId);
        console.log("  Shadowstep (Rogue) itemId:", shadowstepItemId);

        // 6. Entangle (Druid) - status effect only, no damage
        bytes32[] memory entangleEffects = new bytes32[](1);
        entangleEffects[0] = entangleId;
        uint256 entangleItemId = _createSpellWeapon(
            "spell:entangle", 0, 0, 10, entangleEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Druid, entangleItemId);
        console.log("  Entangle (Druid) itemId:", entangleItemId);

        // 7. Soul Drain (Warlock) - magic damage 8-14 + curse debuff
        bytes32[] memory soulDrainEffects = new bytes32[](2);
        soulDrainEffects[0] = soulDrainDmgId;
        soulDrainEffects[1] = soulDrainCurseId;
        uint256 soulDrainItemId = _createSpellWeapon(
            "spell:soul_drain", 8, 14, 10, soulDrainEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Warlock, soulDrainItemId);
        console.log("  Soul Drain (Warlock) itemId:", soulDrainItemId);

        // 8. Arcane Blast (Wizard) - magic damage 12-20
        bytes32[] memory arcaneBlastEffects = new bytes32[](1);
        arcaneBlastEffects[0] = arcaneBlastDmgId;
        uint256 arcaneBlastItemId = _createSpellWeapon(
            "spell:arcane_blast", 12, 20, 10, arcaneBlastEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Wizard, arcaneBlastItemId);
        console.log("  Arcane Blast (Wizard) itemId:", arcaneBlastItemId);

        // 9. Blessing (Cleric) - buff + light divine damage 4-7
        bytes32[] memory blessingEffects = new bytes32[](1);
        blessingEffects[0] = blessingId;
        uint256 blessingItemId = _createSpellWeapon(
            "spell:blessing", 4, 7, 10, blessingEffects, noRestrictions
        );
        _setAdvancedClassItem(AdvancedClass.Cleric, blessingItemId);
        console.log("  Blessing (Cleric) itemId:", blessingItemId);

        console.log("All class spell items created and linked");
    }

    function _createSpellWeapon(
        string memory metadataUri,
        int256 minDamage,
        int256 maxDamage,
        uint256 minLevel,
        bytes32[] memory effects,
        StatRestrictionsData memory restrictions
    ) internal returns (uint256) {
        WeaponStatsData memory weaponStats = WeaponStatsData({
            agiModifier: 0,
            intModifier: 0,
            hpModifier: 0,
            maxDamage: maxDamage,
            minDamage: minDamage,
            minLevel: minLevel,
            strModifier: 0,
            effects: effects
        });

        bytes memory statsEncoded = abi.encode(weaponStats, restrictions);

        // supply=0 (minted on class selection), dropChance=0, price=0
        return world.UD__createItem(
            ItemType.Weapon,
            0,    // supply
            0,    // dropChance
            0,    // price
            1,    // rarity (Common)
            statsEncoded,
            metadataUri
        );
    }

    function _setAdvancedClassItem(AdvancedClass advancedClass, uint256 itemId) internal {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = itemId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        AdvancedClassItems.set(advancedClass, itemIds, amounts);
    }
}
