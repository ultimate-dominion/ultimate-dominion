// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    Effects,
    SpellConfig,
    SpellConfigData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    AdvancedClassItems,
    LevelUnlockItems
} from "@codegen/index.sol";
import {EffectType, AdvancedClass, ItemType, ResistanceStat} from "@codegen/common.sol";

/**
 * @title DeployClassSpellsL15
 * @notice Deploys 9 L15 class spells: creates items, effects, SpellConfig, and
 *         populates LevelUnlockItems table for automatic granting at level 15.
 *
 * Prerequisites:
 * - World must be deployed with LevelUnlockItems + SpellConfig tables
 * - L10 spells must already be deployed (V1 + V2)
 *
 * Usage:
 *   forge script DeployClassSpellsL15 --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract DeployClassSpellsL15 is Script {
    IWorld public world;

    uint256 constant SPELL_LEVEL = 15;

    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployClassSpellsL15 ===");

        // Step 1: Deploy status effects for all 9 spells
        _deployEffects();

        // Step 2: Set SpellConfig (V2 percentage-based scaling)
        _deploySpellConfigs();

        // Step 3: Create spell weapon items and populate LevelUnlockItems
        _createClassSpellItems();

        vm.stopBroadcast();

        console.log("=== DeployClassSpellsL15 Complete ===");
    }

    function _effectId(string memory name) internal pure returns (bytes32) {
        return bytes32(bytes8(keccak256(abi.encode(name))));
    }

    // ========== Step 1: Deploy Effects ==========

    function _deployEffects() internal {
        console.log("Deploying L15 spell effects...");

        // Warcry (Warrior) — self-buff, no resist check
        bytes32 warcryId = _effectId("warcry");
        StatusEffectStats.set(warcryId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.None
        }));
        StatusEffectTargeting.set(warcryId, true);
        StatusEffectValidity.set(warcryId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(warcryId, EffectType.StatusEffect, true);
        console.log("  warcry deployed");

        // Judgment (Paladin) — debuff, resisted by STR
        bytes32 judgmentId = _effectId("judgment");
        StatusEffectStats.set(judgmentId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.Strength
        }));
        StatusEffectTargeting.set(judgmentId, false);
        StatusEffectValidity.set(judgmentId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));
        Effects.set(judgmentId, EffectType.StatusEffect, true);
        console.log("  judgment deployed");

        // Volley (Ranger) — pure damage, no resist
        bytes32 volleyId = _effectId("volley");
        StatusEffectStats.set(volleyId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.None
        }));
        StatusEffectTargeting.set(volleyId, false);
        StatusEffectValidity.set(volleyId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 0
        }));
        Effects.set(volleyId, EffectType.StatusEffect, true);
        console.log("  volley deployed");

        // Backstab (Rogue) — debuff, resisted by AGI
        bytes32 backstabId = _effectId("backstab");
        StatusEffectStats.set(backstabId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.Agility
        }));
        StatusEffectTargeting.set(backstabId, false);
        StatusEffectValidity.set(backstabId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 4
        }));
        Effects.set(backstabId, EffectType.StatusEffect, true);
        console.log("  backstab deployed");

        // Regrowth (Druid) — self-buff, no resist
        bytes32 regrowthId = _effectId("regrowth");
        StatusEffectStats.set(regrowthId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.None
        }));
        StatusEffectTargeting.set(regrowthId, true);
        StatusEffectValidity.set(regrowthId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(regrowthId, EffectType.StatusEffect, true);
        console.log("  regrowth deployed");

        // Blight (Warlock) — debuff, resisted by INT
        bytes32 blightId = _effectId("blight");
        StatusEffectStats.set(blightId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.Intelligence
        }));
        StatusEffectTargeting.set(blightId, false);
        StatusEffectValidity.set(blightId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(blightId, EffectType.StatusEffect, true);
        console.log("  blight deployed");

        // Meteor (Wizard) — pure damage, no resist
        bytes32 meteorId = _effectId("meteor");
        StatusEffectStats.set(meteorId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.None
        }));
        StatusEffectTargeting.set(meteorId, false);
        StatusEffectValidity.set(meteorId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 0
        }));
        Effects.set(meteorId, EffectType.StatusEffect, true);
        console.log("  meteor deployed");

        // Mana Burn (Sorcerer) — debuff, resisted by INT
        bytes32 manaBurnId = _effectId("mana_burn");
        StatusEffectStats.set(manaBurnId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.Intelligence
        }));
        StatusEffectTargeting.set(manaBurnId, false);
        StatusEffectValidity.set(manaBurnId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));
        Effects.set(manaBurnId, EffectType.StatusEffect, true);
        console.log("  mana_burn deployed");

        // Smite (Cleric) — self-buff + damage, no resist
        bytes32 smiteId = _effectId("smite");
        StatusEffectStats.set(smiteId, StatusEffectStatsData({
            strModifier: 0, agiModifier: 0, intModifier: 0,
            armorModifier: 0, hpModifier: 0, damagePerTick: 0,
            resistanceStat: ResistanceStat.None
        }));
        StatusEffectTargeting.set(smiteId, true);
        StatusEffectValidity.set(smiteId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));
        Effects.set(smiteId, EffectType.StatusEffect, true);
        console.log("  smite deployed");

        console.log("All L15 effects deployed");
    }

    // ========== Step 2: SpellConfig ==========

    function _deploySpellConfigs() internal {
        console.log("Deploying L15 SpellConfig entries...");

        // Warrior — Warcry: +30% STR, +15% HP heal, +12 armor, 8-14 phys dmg, 0.6/STR, 1 use
        SpellConfig.set(_effectId("warcry"), SpellConfigData({
            strPct: 3000, agiPct: 0, intPct: 0, hpPct: 1500,
            armorFlat: 12, spellMinDamage: 8, spellMaxDamage: 14,
            dmgPerStat: 600, dmgScalingStat: ResistanceStat.Strength,
            dmgIsPhysical: true, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  warcry SpellConfig set");

        // Paladin — Judgment: -20% STR, -15% AGI debuff, -10 armor, 6-12 phys dmg, 0.5/STR, 2 uses
        SpellConfig.set(_effectId("judgment"), SpellConfigData({
            strPct: -2000, agiPct: -1500, intPct: 0, hpPct: 0,
            armorFlat: -10, spellMinDamage: 6, spellMaxDamage: 12,
            dmgPerStat: 500, dmgScalingStat: ResistanceStat.Strength,
            dmgIsPhysical: true, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  judgment SpellConfig set");

        // Ranger — Volley: pure phys dmg 7-14, 0.6/AGI, 3 uses
        SpellConfig.set(_effectId("volley"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: 0, spellMinDamage: 7, spellMaxDamage: 14,
            dmgPerStat: 600, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 3, isWeaponEnchant: false
        }));
        console.log("  volley SpellConfig set");

        // Rogue — Backstab: -25% STR debuff, -12 armor, 10-18 phys dmg, 0.8/AGI, 1 use
        SpellConfig.set(_effectId("backstab"), SpellConfigData({
            strPct: -2500, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: -12, spellMinDamage: 10, spellMaxDamage: 18,
            dmgPerStat: 800, dmgScalingStat: ResistanceStat.Agility,
            dmgIsPhysical: true, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  backstab SpellConfig set");

        // Druid — Regrowth: +20% INT, +25% HP heal, +10 armor, no dmg, 2 uses
        SpellConfig.set(_effectId("regrowth"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 2000, hpPct: 2500,
            armorFlat: 10, spellMinDamage: 0, spellMaxDamage: 0,
            dmgPerStat: 0, dmgScalingStat: ResistanceStat.None,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  regrowth SpellConfig set");

        // Warlock — Blight: -20% STR, -20% AGI, -20% INT debuff, -5 armor, 5-10 magic dmg, 0.4/INT, 1 use
        SpellConfig.set(_effectId("blight"), SpellConfigData({
            strPct: -2000, agiPct: -2000, intPct: -2000, hpPct: 0,
            armorFlat: -5, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 1, isWeaponEnchant: false
        }));
        console.log("  blight SpellConfig set");

        // Wizard — Meteor: pure magic dmg 8-16, 0.7/INT, 2 uses
        SpellConfig.set(_effectId("meteor"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 0, hpPct: 0,
            armorFlat: 0, spellMinDamage: 8, spellMaxDamage: 16,
            dmgPerStat: 700, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  meteor SpellConfig set");

        // Sorcerer — Mana Burn: -25% INT debuff, -5 armor, 5-10 magic dmg, 0.5/INT, unlimited
        SpellConfig.set(_effectId("mana_burn"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: -2500, hpPct: 0,
            armorFlat: -5, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 500, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 0, isWeaponEnchant: false
        }));
        console.log("  mana_burn SpellConfig set");

        // Cleric — Smite: +15% INT, +15% HP heal, +8 armor, 5-10 magic dmg, 0.4/INT, 2 uses
        SpellConfig.set(_effectId("smite"), SpellConfigData({
            strPct: 0, agiPct: 0, intPct: 1500, hpPct: 1500,
            armorFlat: 8, spellMinDamage: 5, spellMaxDamage: 10,
            dmgPerStat: 400, dmgScalingStat: ResistanceStat.Intelligence,
            dmgIsPhysical: false, maxUses: 2, isWeaponEnchant: false
        }));
        console.log("  smite SpellConfig set");

        console.log("All L15 SpellConfig entries deployed");
    }

    // ========== Step 3: Create Items + LevelUnlockItems ==========

    function _createClassSpellItems() internal {
        console.log("Creating L15 class spell items...");

        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minAgility: 0, minIntelligence: 0, minStrength: 0
        });

        // Warrior — Warcry
        bytes32[] memory warcryEffects = new bytes32[](1);
        warcryEffects[0] = _effectId("warcry");
        uint256 warcryItemId = _createSpellWeapon("spell:warcry", 0, 0, SPELL_LEVEL, warcryEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Warrior, warcryItemId);
        console.log("  Warcry (Warrior) itemId:", warcryItemId);

        // Paladin — Judgment
        bytes32[] memory judgmentEffects = new bytes32[](1);
        judgmentEffects[0] = _effectId("judgment");
        uint256 judgmentItemId = _createSpellWeapon("spell:judgment", 0, 0, SPELL_LEVEL, judgmentEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Paladin, judgmentItemId);
        console.log("  Judgment (Paladin) itemId:", judgmentItemId);

        // Ranger — Volley
        bytes32[] memory volleyEffects = new bytes32[](1);
        volleyEffects[0] = _effectId("volley");
        uint256 volleyItemId = _createSpellWeapon("spell:volley", 0, 0, SPELL_LEVEL, volleyEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Ranger, volleyItemId);
        console.log("  Volley (Ranger) itemId:", volleyItemId);

        // Rogue — Backstab
        bytes32[] memory backstabEffects = new bytes32[](1);
        backstabEffects[0] = _effectId("backstab");
        uint256 backstabItemId = _createSpellWeapon("spell:backstab", 0, 0, SPELL_LEVEL, backstabEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Rogue, backstabItemId);
        console.log("  Backstab (Rogue) itemId:", backstabItemId);

        // Druid — Regrowth
        bytes32[] memory regrowthEffects = new bytes32[](1);
        regrowthEffects[0] = _effectId("regrowth");
        uint256 regrowthItemId = _createSpellWeapon("spell:regrowth", 0, 0, SPELL_LEVEL, regrowthEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Druid, regrowthItemId);
        console.log("  Regrowth (Druid) itemId:", regrowthItemId);

        // Warlock — Blight
        bytes32[] memory blightEffects = new bytes32[](1);
        blightEffects[0] = _effectId("blight");
        uint256 blightItemId = _createSpellWeapon("spell:blight", 0, 0, SPELL_LEVEL, blightEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Warlock, blightItemId);
        console.log("  Blight (Warlock) itemId:", blightItemId);

        // Wizard — Meteor
        bytes32[] memory meteorEffects = new bytes32[](1);
        meteorEffects[0] = _effectId("meteor");
        uint256 meteorItemId = _createSpellWeapon("spell:meteor", 0, 0, SPELL_LEVEL, meteorEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Wizard, meteorItemId);
        console.log("  Meteor (Wizard) itemId:", meteorItemId);

        // Sorcerer — Mana Burn
        bytes32[] memory manaBurnEffects = new bytes32[](1);
        manaBurnEffects[0] = _effectId("mana_burn");
        uint256 manaBurnItemId = _createSpellWeapon("spell:mana_burn", 0, 0, SPELL_LEVEL, manaBurnEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Sorcerer, manaBurnItemId);
        console.log("  Mana Burn (Sorcerer) itemId:", manaBurnItemId);

        // Cleric — Smite
        bytes32[] memory smiteEffects = new bytes32[](1);
        smiteEffects[0] = _effectId("smite");
        uint256 smiteItemId = _createSpellWeapon("spell:smite", 0, 0, SPELL_LEVEL, smiteEffects, noRestrictions);
        _setLevelUnlockItem(AdvancedClass.Cleric, smiteItemId);
        console.log("  Smite (Cleric) itemId:", smiteItemId);

        console.log("All L15 spell items created and LevelUnlockItems populated");
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

        // supply=0 (minted at level up), dropChance=0, price=0
        return world.UD__createItem(
            ItemType.Spell,
            0,    // supply
            0,    // dropChance
            0,    // price
            1,    // rarity (Common)
            statsEncoded,
            metadataUri
        );
    }

    function _setLevelUnlockItem(AdvancedClass advancedClass, uint256 itemId) internal {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = itemId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        LevelUnlockItems.set(SPELL_LEVEL, advancedClass, itemIds, amounts);
    }
}
