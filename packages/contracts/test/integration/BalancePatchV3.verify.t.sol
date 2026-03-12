// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title BalancePatchV3 Verification Tests
 * @notice Fork-mode tests to verify on-chain values after BalancePatchV3 is applied.
 *         Runs against any world (local anvil, beta, or prod).
 *
 * Usage:
 *   WORLD_ADDRESS=0x... forge test \
 *     --match-contract BalancePatchV3Verify --fork-url <RPC> -vv --skip script
 */

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    StatRestrictions,
    StatRestrictionsData,
    Items,
    ItemsData,
    Mobs,
    Effects,
    EffectsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    MagicDamageStats,
    MagicDamageStatsData,
    SpellScaling,
    AdvancedClassItems
} from "@codegen/index.sol";
import {
    ItemType,
    EffectType,
    ResistanceStat,
    AdvancedClass,
    Classes
} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {ResourceId} from "@latticexyz/world/src/WorldResourceId.sol";

contract BalancePatchV3Verify is Test {
    IWorld public world;

    function setUp() public {
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        require(worldAddress != address(0), "WORLD_ADDRESS not set");
        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);
    }

    // =====================================================================
    //  Helpers
    // =====================================================================

    function _getMonsterStats(uint256 mobId) internal view returns (MonsterStats memory) {
        bytes memory raw = Mobs.getMobStats(mobId);
        return abi.decode(raw, (MonsterStats));
    }

    function _getSpellItemId(AdvancedClass ac) internal view returns (uint256) {
        return AdvancedClassItems.getItemIds(ac)[0];
    }

    // =====================================================================
    //  1. EFFECTS
    // =====================================================================

    function test_effect_poisonDot() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("poison_dot"))));
        EffectsData memory e = Effects.get(id);
        EffectType t = e.effectType;
        assertEq(uint8(t), uint8(EffectType.StatusEffect), "poison_dot type");

        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.damagePerTick, 3, "poison_dot damagePerTick");
        assertEq(s.agiModifier, 0);
        assertEq(s.strModifier, 0);

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.maxStacks, 2, "poison_dot maxStacks");
        assertEq(v.validTurns, 8, "poison_dot validTurns");
        assertEq(v.cooldown, 2, "poison_dot cooldown");
    }

    function test_effect_blind() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("blind"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.agiModifier, -8, "blind agiMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.maxStacks, 1);
        assertEq(v.validTurns, 8);
        assertEq(v.cooldown, 3);
    }

    function test_effect_weaken() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("weaken"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.strModifier, -8, "weaken strMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.maxStacks, 1);
        assertEq(v.validTurns, 8);
        assertEq(v.cooldown, 3);
    }

    function test_effect_stupify() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("stupify"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.intModifier, -8, "stupify intMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.maxStacks, 1);
        assertEq(v.validTurns, 8);
        assertEq(v.cooldown, 3);
    }

    function test_effect_petrifyingGazeDmg() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("petrifying_gaze_dmg"))));
        EffectsData memory e = Effects.get(id);
        EffectType t = e.effectType;
        assertEq(uint8(t), uint8(EffectType.MagicDamage), "petrifying_gaze type");

        MagicDamageStatsData memory s = MagicDamageStats.get(id);
        assertEq(s.bonusDamage, 0);
    }

    function test_effect_venomDot() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("venom_dot"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.damagePerTick, 5, "venom_dot damagePerTick");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.maxStacks, 1);
        assertEq(v.validTurns, 6);
        assertEq(v.cooldown, 3);
    }

    // =====================================================================
    //  2. WEAPON UPDATES
    // =====================================================================

    function test_weapon_huntingBow_30() public {
        WeaponStatsData memory w = WeaponStats.get(30);
        assertEq(w.hpModifier, 2, "Hunting Bow hpMod");
    }

    function test_weapon_lightMace_32() public {
        WeaponStatsData memory w = WeaponStats.get(32);
        StatRestrictionsData memory r = StatRestrictions.get(32);
        assertEq(w.hpModifier, 3, "Light Mace hpMod");
        assertEq(r.minStrength, 8, "Light Mace strReq");
        assertEq(r.minAgility, 3, "Light Mace agiReq");
    }

    function test_weapon_shortbow_33() public {
        WeaponStatsData memory w = WeaponStats.get(33);
        StatRestrictionsData memory r = StatRestrictions.get(33);
        assertEq(w.hpModifier, 3, "Shortbow hpMod");
        assertEq(r.minStrength, 4, "Shortbow strReq");
    }

    function test_weapon_channelingRod_34() public {
        WeaponStatsData memory w = WeaponStats.get(34);
        StatRestrictionsData memory r = StatRestrictions.get(34);
        assertEq(w.hpModifier, 3, "Channeling Rod hpMod");
        assertEq(r.minStrength, 3, "Channeling Rod strReq");
        assertEq(r.minIntelligence, 9, "Channeling Rod intReq");
    }

    function test_weapon_notchedBlade_35() public {
        StatRestrictionsData memory r = StatRestrictions.get(35);
        assertEq(r.minStrength, 4, "Notched Blade strReq");
        assertEq(r.minIntelligence, 4, "Notched Blade intReq");
    }

    function test_weapon_warhammer_36() public {
        WeaponStatsData memory w = WeaponStats.get(36);
        StatRestrictionsData memory r = StatRestrictions.get(36);
        assertEq(w.hpModifier, 5, "Warhammer hpMod");
        assertEq(r.minStrength, 11, "Warhammer strReq");
        assertEq(r.minAgility, 4, "Warhammer agiReq");
    }

    function test_weapon_longbow_37() public {
        WeaponStatsData memory w = WeaponStats.get(37);
        StatRestrictionsData memory r = StatRestrictions.get(37);
        assertEq(w.maxDamage, 7, "Longbow maxDmg");
        assertEq(w.hpModifier, 5, "Longbow hpMod");
        assertEq(r.minStrength, 4, "Longbow strReq");
        assertEq(r.minAgility, 13, "Longbow agiReq");
    }

    function test_weapon_mageStaff_38() public {
        StatRestrictionsData memory r = StatRestrictions.get(38);
        assertEq(r.minStrength, 4, "Mage Staff strReq");
        assertEq(r.minIntelligence, 9, "Mage Staff intReq");
    }

    function test_weapon_notchedCleaver_41() public {
        WeaponStatsData memory w = WeaponStats.get(41);
        StatRestrictionsData memory r = StatRestrictions.get(41);
        assertEq(w.hpModifier, 2, "Notched Cleaver hpMod");
        assertEq(r.minAgility, 3, "Notched Cleaver agiReq");
    }

    function test_weapon_crystalShard_42() public {
        WeaponStatsData memory w = WeaponStats.get(42);
        StatRestrictionsData memory r = StatRestrictions.get(42);
        assertEq(w.minDamage, 4, "Crystal Shard minDmg");
        assertEq(w.maxDamage, 6, "Crystal Shard maxDmg");
        assertEq(r.minStrength, 6, "Crystal Shard strReq");
        assertEq(r.minIntelligence, 6, "Crystal Shard intReq");
    }

    function test_weapon_gnarledCudgel_43() public {
        WeaponStatsData memory w = WeaponStats.get(43);
        StatRestrictionsData memory r = StatRestrictions.get(43);
        assertEq(w.hpModifier, 3, "Gnarled Cudgel hpMod");
        assertEq(r.minStrength, 10, "Gnarled Cudgel strReq");
        assertEq(r.minAgility, 4, "Gnarled Cudgel agiReq");
    }

    function test_weapon_webspinnerBow_44() public {
        WeaponStatsData memory w = WeaponStats.get(44);
        StatRestrictionsData memory r = StatRestrictions.get(44);
        assertEq(w.maxDamage, 5, "Webspinner maxDmg");
        assertEq(w.hpModifier, 4, "Webspinner hpMod");
        assertEq(r.minStrength, 5, "Webspinner strReq");
    }

    function test_weapon_boneStaff_45() public {
        WeaponStatsData memory w = WeaponStats.get(45);
        StatRestrictionsData memory r = StatRestrictions.get(45);
        assertEq(w.hpModifier, 5, "Bone Staff hpMod");
        assertEq(r.minStrength, 4, "Bone Staff strReq");
        assertEq(r.minIntelligence, 11, "Bone Staff intReq");
    }

    function test_weapon_stoneMaul_46() public {
        WeaponStatsData memory w = WeaponStats.get(46);
        StatRestrictionsData memory r = StatRestrictions.get(46);
        assertEq(w.maxDamage, 6, "Stone Maul maxDmg");
        assertEq(w.strModifier, 3, "Stone Maul strMod");
        assertEq(w.hpModifier, 5, "Stone Maul hpMod");
        assertEq(r.minStrength, 13, "Stone Maul strReq");
        assertEq(r.minAgility, 5, "Stone Maul agiReq");
    }

    function test_weapon_darkwoodBow_47() public {
        WeaponStatsData memory w = WeaponStats.get(47);
        StatRestrictionsData memory r = StatRestrictions.get(47);
        ItemsData memory item = Items.get(47);
        assertEq(w.hpModifier, 6, "Darkwood Bow hpMod");
        assertEq(r.minStrength, 4, "Darkwood Bow strReq");
        assertEq(r.minAgility, 14, "Darkwood Bow agiReq");
        assertEq(item.rarity, 3, "Darkwood Bow rarity R4->R3");
    }

    function test_weapon_smolderingRod_48() public {
        WeaponStatsData memory w = WeaponStats.get(48);
        StatRestrictionsData memory r = StatRestrictions.get(48);
        ItemsData memory item = Items.get(48);
        assertEq(w.maxDamage, 7, "Smoldering Rod maxDmg");
        assertEq(w.hpModifier, 6, "Smoldering Rod hpMod");
        assertEq(r.minStrength, 5, "Smoldering Rod strReq");
        assertEq(r.minIntelligence, 13, "Smoldering Rod intReq");
        assertEq(item.rarity, 3, "Smoldering Rod rarity R4->R3");
    }

    // =====================================================================
    //  3. ARMOR UPDATES
    // =====================================================================

    function test_armor_studdedLeather_16() public {
        ItemsData memory item = Items.get(16);
        assertEq(item.price, 40, "Studded Leather price 35->40");
    }

    function test_armor_scoutArmor_17() public {
        ItemsData memory item = Items.get(17);
        assertEq(item.price, 40, "Scout Armor price 35->40");
    }

    function test_armor_acolyteVestments_18() public {
        ItemsData memory item = Items.get(18);
        assertEq(item.price, 40, "Acolyte Vestments price 35->40");
    }

    function test_armor_etchedChainmail_19() public {
        StatRestrictionsData memory r = StatRestrictions.get(19);
        ItemsData memory item = Items.get(19);
        assertEq(r.minIntelligence, 7, "Etched Chainmail intReq");
        assertEq(item.price, 100, "Etched Chainmail price 80->100");
    }

    function test_armor_rangerLeathers_20() public {
        StatRestrictionsData memory r = StatRestrictions.get(20);
        ItemsData memory item = Items.get(20);
        assertEq(r.minIntelligence, 8, "Ranger Leathers intReq");
        assertEq(item.price, 100, "Ranger Leathers price 80->100");
    }

    function test_armor_mageRobes_21() public {
        StatRestrictionsData memory r = StatRestrictions.get(21);
        ItemsData memory item = Items.get(21);
        assertEq(r.minAgility, 10, "Mage Robes agiReq");
        assertEq(item.price, 100, "Mage Robes price 80->100");
    }

    function test_armor_spiderSilkWraps_22() public {
        StatRestrictionsData memory r = StatRestrictions.get(22);
        assertEq(r.minIntelligence, 8, "Spider Silk Wraps intReq");
    }

    function test_armor_carvedStonePlate_23() public {
        ArmorStatsData memory a = ArmorStats.get(23);
        StatRestrictionsData memory r = StatRestrictions.get(23);
        assertEq(a.armorModifier, 10, "Carved Stone Plate ARM 8->10");
        assertEq(a.hpModifier, 10, "Carved Stone Plate hpMod 8->10");
        assertEq(r.minIntelligence, 9, "Carved Stone Plate intReq");
    }

    function test_armor_stalkersCloak_24() public {
        ArmorStatsData memory a = ArmorStats.get(24);
        StatRestrictionsData memory r = StatRestrictions.get(24);
        assertEq(a.armorModifier, 7, "Stalker's Cloak ARM 5->7");
        assertEq(r.minIntelligence, 10, "Stalker's Cloak intReq");
    }

    function test_armor_scorchedScaleVest_25() public {
        StatRestrictionsData memory r = StatRestrictions.get(25);
        ItemsData memory item = Items.get(25);
        assertEq(r.minIntelligence, 9, "Scorched Scale Vest intReq");
        assertEq(item.price, 250, "Scorched Scale Vest price 300->250");
    }

    // =====================================================================
    //  4. MONSTERS
    // =====================================================================

    function test_monster_direRat() public {
        MonsterStats memory m = _getMonsterStats(1);
        assertEq(m.strength, 3, "Dire Rat STR");
        assertEq(m.agility, 6, "Dire Rat AGI");
        assertEq(m.intelligence, 2, "Dire Rat INT");
        assertEq(m.hitPoints, 10, "Dire Rat HP");
        assertEq(m.armor, 0, "Dire Rat ARM");
        assertFalse(m.hasBossAI, "Dire Rat not boss");
        // Dire Rat inventory[0] should be the new poison bite weapon
        assertTrue(m.inventory.length >= 1, "Dire Rat has inventory");
    }

    function test_monster_fungalShaman() public {
        MonsterStats memory m = _getMonsterStats(2);
        assertEq(m.strength, 3, "Fungal Shaman STR");
        assertEq(m.agility, 4, "Fungal Shaman AGI");
        assertEq(m.intelligence, 8, "Fungal Shaman INT");
        assertEq(m.hitPoints, 12, "Fungal Shaman HP");
    }

    function test_monster_cavernBrute() public {
        MonsterStats memory m = _getMonsterStats(3);
        assertEq(m.strength, 9, "Cavern Brute STR");
        assertEq(m.agility, 4, "Cavern Brute AGI");
        assertEq(m.intelligence, 3, "Cavern Brute INT");
        assertEq(m.hitPoints, 18, "Cavern Brute HP");
        assertEq(m.armor, 1, "Cavern Brute ARM");
    }

    function test_monster_crystalElemental() public {
        MonsterStats memory m = _getMonsterStats(4);
        assertEq(m.strength, 4, "Crystal Elemental STR");
        assertEq(m.agility, 5, "Crystal Elemental AGI");
        assertEq(m.intelligence, 10, "Crystal Elemental INT");
        assertEq(m.hitPoints, 16, "Crystal Elemental HP");
    }

    function test_monster_ironhideTroll() public {
        MonsterStats memory m = _getMonsterStats(5);
        assertEq(m.strength, 11, "Ironhide Troll STR");
        assertEq(m.agility, 6, "Ironhide Troll AGI");
        assertEq(m.intelligence, 5, "Ironhide Troll INT");
        assertEq(m.hitPoints, 26, "Ironhide Troll HP");
        assertEq(m.armor, 2, "Ironhide Troll ARM");
    }

    function test_monster_phaseSpider() public {
        MonsterStats memory m = _getMonsterStats(6);
        assertEq(m.strength, 8, "Phase Spider STR");
        assertEq(m.agility, 12, "Phase Spider AGI");
        assertEq(m.intelligence, 5, "Phase Spider INT");
        assertEq(m.hitPoints, 22, "Phase Spider HP");
    }

    function test_monster_bonecaster() public {
        MonsterStats memory m = _getMonsterStats(7);
        assertEq(m.strength, 6, "Bonecaster STR");
        assertEq(m.agility, 7, "Bonecaster AGI");
        assertEq(m.intelligence, 13, "Bonecaster INT");
        assertEq(m.hitPoints, 26, "Bonecaster HP");
    }

    function test_monster_rockGolem() public {
        MonsterStats memory m = _getMonsterStats(8);
        assertEq(m.strength, 14, "Rock Golem STR");
        assertEq(m.agility, 8, "Rock Golem AGI");
        assertEq(m.intelligence, 7, "Rock Golem INT");
        assertEq(m.hitPoints, 38, "Rock Golem HP");
        assertEq(m.armor, 3, "Rock Golem ARM");
    }

    function test_monster_paleStalker() public {
        MonsterStats memory m = _getMonsterStats(9);
        assertEq(m.strength, 10, "Pale Stalker STR");
        assertEq(m.agility, 15, "Pale Stalker AGI");
        assertEq(m.intelligence, 7, "Pale Stalker INT");
        assertEq(m.hitPoints, 34, "Pale Stalker HP");
    }

    function test_monster_duskDrake() public {
        MonsterStats memory m = _getMonsterStats(10);
        assertEq(m.strength, 13, "Dusk Drake STR");
        assertEq(m.agility, 13, "Dusk Drake AGI");
        assertEq(m.intelligence, 15, "Dusk Drake INT");
        assertEq(m.hitPoints, 52, "Dusk Drake HP");
        assertEq(m.armor, 2, "Dusk Drake ARM");
    }

    function test_monster_xpPreserved() public {
        // XP should be the on-chain values, NOT the BALANCE_PATCH beta values
        // We can't assert exact values (depends on what was on-chain before),
        // but we verify XP is non-zero for all mobs
        for (uint256 i = 1; i <= 10; i++) {
            MonsterStats memory m = _getMonsterStats(i);
            assertTrue(m.experience > 0, "Mob XP should be non-zero");
        }
    }

    // =====================================================================
    //  5. BASILISK
    // =====================================================================

    function test_basilisk_exists() public {
        // Basilisk is mob 12 (IDs 1-10 monsters, 11 shop, 12 Basilisk)
        MonsterStats memory m = _getMonsterStats(12);
        assertEq(m.strength, 20, "Basilisk STR");
        assertEq(m.agility, 12, "Basilisk AGI");
        assertEq(m.intelligence, 10, "Basilisk INT");
        assertEq(m.hitPoints, 100, "Basilisk HP");
        assertEq(m.armor, 4, "Basilisk ARM");
        assertEq(m.experience, 10000, "Basilisk XP");
        assertTrue(m.hasBossAI, "Basilisk hasBossAI");
        assertEq(m.level, 10, "Basilisk level");
        assertEq(uint8(m.class), uint8(Classes.Warrior), "Basilisk class");
        assertEq(m.inventory.length, 2, "Basilisk has 2 weapons");
    }

    // =====================================================================
    //  6. SPELL WEAPON DAMAGE
    // =====================================================================

    function test_spell_battleCry_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Warrior);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 4, "Battle Cry minDmg");
        assertEq(w.maxDamage, 8, "Battle Cry maxDmg");
    }

    function test_spell_divineShield_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Paladin);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 3, "Divine Shield minDmg");
        assertEq(w.maxDamage, 7, "Divine Shield maxDmg");
    }

    function test_spell_arcaneSurge_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Sorcerer);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 4, "Arcane Surge minDmg");
        assertEq(w.maxDamage, 8, "Arcane Surge maxDmg");
    }

    function test_spell_huntersMark_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Ranger);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 3, "Hunter's Mark minDmg");
        assertEq(w.maxDamage, 7, "Hunter's Mark maxDmg");
    }

    function test_spell_shadowstep_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Rogue);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 4, "Shadowstep minDmg");
        assertEq(w.maxDamage, 8, "Shadowstep maxDmg");
    }

    function test_spell_entangle_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Druid);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 3, "Entangle minDmg");
        assertEq(w.maxDamage, 6, "Entangle maxDmg");
    }

    function test_spell_soulDrain_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Warlock);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 4, "Soul Drain minDmg");
        assertEq(w.maxDamage, 8, "Soul Drain maxDmg");
    }

    function test_spell_arcaneBlast_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Wizard);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 5, "Arcane Blast minDmg");
        assertEq(w.maxDamage, 10, "Arcane Blast maxDmg");
    }

    function test_spell_blessing_damage() public {
        uint256 id = _getSpellItemId(AdvancedClass.Cleric);
        WeaponStatsData memory w = WeaponStats.get(id);
        assertEq(w.minDamage, 0, "Blessing minDmg");
        assertEq(w.maxDamage, 0, "Blessing maxDmg");
    }

    // =====================================================================
    //  7. SPELL SCALING
    // =====================================================================

    function test_spellScaling() public {
        bytes32 battleCry = bytes32(bytes8(keccak256(abi.encode("battle_cry"))));
        bytes32 divineShield = bytes32(bytes8(keccak256(abi.encode("divine_shield"))));
        bytes32 huntersMark = bytes32(bytes8(keccak256(abi.encode("hunters_mark"))));
        bytes32 shadowstep = bytes32(bytes8(keccak256(abi.encode("shadowstep"))));
        bytes32 entangle = bytes32(bytes8(keccak256(abi.encode("entangle"))));
        bytes32 soulDrainDmg = bytes32(bytes8(keccak256(abi.encode("soul_drain_damage"))));
        bytes32 soulDrainCurse = bytes32(bytes8(keccak256(abi.encode("soul_drain_curse"))));
        bytes32 arcaneSurgeDmg = bytes32(bytes8(keccak256(abi.encode("arcane_surge_damage"))));
        bytes32 arcaneBlastDmg = bytes32(bytes8(keccak256(abi.encode("arcane_blast_damage"))));
        bytes32 blessing = bytes32(bytes8(keccak256(abi.encode("blessing"))));

        assertEq(uint8(SpellScaling.getScalingStat(battleCry)), uint8(ResistanceStat.Strength));
        assertEq(uint8(SpellScaling.getScalingStat(divineShield)), uint8(ResistanceStat.Strength));
        assertEq(uint8(SpellScaling.getScalingStat(huntersMark)), uint8(ResistanceStat.Agility));
        assertEq(uint8(SpellScaling.getScalingStat(shadowstep)), uint8(ResistanceStat.Agility));
        assertEq(uint8(SpellScaling.getScalingStat(entangle)), uint8(ResistanceStat.Intelligence));
        assertEq(uint8(SpellScaling.getScalingStat(soulDrainDmg)), uint8(ResistanceStat.Intelligence));
        assertEq(uint8(SpellScaling.getScalingStat(soulDrainCurse)), uint8(ResistanceStat.Intelligence));
        assertEq(uint8(SpellScaling.getScalingStat(arcaneSurgeDmg)), uint8(ResistanceStat.Intelligence));
        assertEq(uint8(SpellScaling.getScalingStat(arcaneBlastDmg)), uint8(ResistanceStat.Intelligence));
        assertEq(uint8(SpellScaling.getScalingStat(blessing)), uint8(ResistanceStat.None));
    }

    // =====================================================================
    //  8. SPELL STATUS EFFECT UPDATES
    // =====================================================================

    function test_spellEffect_battleCry() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("battle_cry"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.strModifier, 3, "battle_cry strMod");
        assertEq(s.armorModifier, 3, "battle_cry armMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 6, "battle_cry duration");
    }

    function test_spellEffect_divineShield() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("divine_shield"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.strModifier, 3, "divine_shield strMod");
        assertEq(s.armorModifier, 5, "divine_shield armMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 6, "divine_shield duration");
    }

    function test_spellEffect_huntersMark() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("hunters_mark"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.agiModifier, -3, "hunters_mark agiMod");
        assertEq(s.armorModifier, -2, "hunters_mark armMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 6, "hunters_mark duration");
    }

    function test_spellEffect_shadowstep() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("shadowstep"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.agiModifier, 5, "shadowstep agiMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 4, "shadowstep duration");
    }

    function test_spellEffect_entangle() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("entangle"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.agiModifier, -3, "entangle agiMod");
        assertEq(s.strModifier, -2, "entangle strMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 6, "entangle duration");
    }

    function test_spellEffect_soulDrainCurse() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("soul_drain_curse"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.strModifier, -3, "soul_drain_curse strMod");
        assertEq(s.intModifier, -3, "soul_drain_curse intMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 5, "soul_drain_curse duration");
    }

    function test_spellEffect_blessing() public {
        bytes32 id = bytes32(bytes8(keccak256(abi.encode("blessing"))));
        StatusEffectStatsData memory s = StatusEffectStats.get(id);
        assertEq(s.intModifier, 3, "blessing intMod");
        assertEq(s.armorModifier, 5, "blessing armMod");
        assertEq(s.hpModifier, 4, "blessing hpMod");

        StatusEffectValidityData memory v = StatusEffectValidity.get(id);
        assertEq(v.validTurns, 6, "blessing duration");
    }

    // =====================================================================
    //  9. MONSTER RENAMES
    // =====================================================================

    function test_monsterRename_direRat() public {
        string memory meta = Mobs.getMobMetadata(1);
        assertEq(meta, "dire_rat", "Mob 1 metadata should be dire_rat");
    }

    function test_monsterRename_ironhideTroll() public {
        string memory meta = Mobs.getMobMetadata(5);
        assertEq(meta, "ironhide_troll", "Mob 5 metadata should be ironhide_troll");
    }

    function test_monsterRename_bonecaster() public {
        string memory meta = Mobs.getMobMetadata(7);
        assertEq(meta, "bonecaster", "Mob 7 metadata should be bonecaster");
    }

    function test_monsterRename_rockGolem() public {
        string memory meta = Mobs.getMobMetadata(8);
        assertEq(meta, "rock_golem", "Mob 8 metadata should be rock_golem");
    }

    function test_monsterRename_paleStalker() public {
        string memory meta = Mobs.getMobMetadata(9);
        assertEq(meta, "pale_stalker", "Mob 9 metadata should be pale_stalker");
    }

    function test_monsterRename_duskDrake() public {
        string memory meta = Mobs.getMobMetadata(10);
        assertEq(meta, "dusk_drake", "Mob 10 metadata should be dusk_drake");
    }

    // =====================================================================
    //  10. NEW WEAPONS
    // =====================================================================

    /// @dev New item IDs are sequential from the counter. We find them by scanning
    ///      ERC1155URIStorage since IDs depend on creation order.

    function _findItemByMetadata(string memory targetUri) internal view returns (uint256) {
        ResourceId uriTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);
        for (uint256 id = 49; id < 120; id++) {
            string memory uri = ERC1155URIStorage.getUri(uriTableId, id);
            if (keccak256(bytes(uri)) == keccak256(bytes(targetUri))) return id;
        }
        revert(string.concat("Item not found: ", targetUri));
    }

    function test_newWeapon_trollhideCleaver() public {
        uint256 id = _findItemByMetadata("trollhide_cleaver");
        WeaponStatsData memory w = WeaponStats.get(id);
        StatRestrictionsData memory r = StatRestrictions.get(id);
        ItemsData memory item = Items.get(id);

        assertEq(w.minDamage, 6, "Trollhide minDmg");
        assertEq(w.maxDamage, 9, "Trollhide maxDmg");
        assertEq(w.strModifier, 3, "Trollhide strMod");
        assertEq(w.agiModifier, 3, "Trollhide agiMod");
        assertEq(w.hpModifier, 5, "Trollhide hpMod");
        assertEq(r.minStrength, 16, "Trollhide strReq");
        assertEq(r.minAgility, 13, "Trollhide agiReq");
        assertEq(item.rarity, 4, "Trollhide rarity");
        assertEq(item.price, 350, "Trollhide price");
    }

    function test_newWeapon_phasefang() public {
        uint256 id = _findItemByMetadata("phasefang");
        WeaponStatsData memory w = WeaponStats.get(id);
        StatRestrictionsData memory r = StatRestrictions.get(id);
        ItemsData memory item = Items.get(id);

        assertEq(w.minDamage, 5, "Phasefang minDmg");
        assertEq(w.maxDamage, 10, "Phasefang maxDmg");
        assertEq(w.agiModifier, 4, "Phasefang agiMod");
        assertEq(w.intModifier, 3, "Phasefang intMod");
        assertEq(w.hpModifier, 5, "Phasefang hpMod");
        assertEq(r.minAgility, 16, "Phasefang agiReq");
        assertEq(r.minIntelligence, 11, "Phasefang intReq");
        assertEq(item.rarity, 4, "Phasefang rarity");
        assertEq(item.price, 350, "Phasefang price");
    }

    function test_newWeapon_drakescaleStaff() public {
        uint256 id = _findItemByMetadata("drakescale_staff");
        WeaponStatsData memory w = WeaponStats.get(id);
        StatRestrictionsData memory r = StatRestrictions.get(id);
        ItemsData memory item = Items.get(id);

        assertEq(w.minDamage, 5, "Drakescale minDmg");
        assertEq(w.maxDamage, 8, "Drakescale maxDmg");
        assertEq(w.strModifier, 2, "Drakescale strMod");
        assertEq(w.intModifier, 3, "Drakescale intMod");
        assertEq(w.hpModifier, 5, "Drakescale hpMod");
        assertEq(r.minStrength, 16, "Drakescale strReq");
        assertEq(r.minIntelligence, 11, "Drakescale intReq");
        assertEq(item.rarity, 4, "Drakescale rarity");
        assertEq(item.price, 350, "Drakescale price");
    }

    // =====================================================================
    //  11. NEW ARMOR
    // =====================================================================

    function test_newArmor_drakesCowl() public {
        uint256 id = _findItemByMetadata("drakes_cowl");
        ArmorStatsData memory a = ArmorStats.get(id);
        StatRestrictionsData memory r = StatRestrictions.get(id);
        ItemsData memory item = Items.get(id);

        assertEq(a.armorModifier, 6, "Drake's Cowl ARM");
        assertEq(a.intModifier, 5, "Drake's Cowl intMod");
        assertEq(r.minAgility, 12, "Drake's Cowl agiReq");
        assertEq(r.minIntelligence, 14, "Drake's Cowl intReq");
        assertEq(item.rarity, 3, "Drake's Cowl rarity");
        assertEq(item.price, 200, "Drake's Cowl price");
    }
}
