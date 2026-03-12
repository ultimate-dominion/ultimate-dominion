// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {
    Effects,
    Items,
    ItemsData,
    Mobs,
    MagicDamageStats,
    MagicDamageStatsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectTargeting,
    StatusEffectValidity,
    StatusEffectValidityData,
    WeaponStats,
    WeaponStatsData,
    ArmorStats,
    ArmorStatsData,
    StatRestrictions,
    StatRestrictionsData,
    AdvancedClassItems,
    SpellScaling,
    Counters,
    MobsByLevel
} from "@codegen/index.sol";
import {
    EffectType,
    AdvancedClass,
    ItemType,
    MobType,
    ResistanceStat,
    Classes,
    ArmorType
} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";

/// @dev On-chain mobs were written with an older MonsterStats that lacked hasBossAI.
///      This struct matches that layout so we can decode existing data.
struct OldMonsterStats {
    int256 agility;
    int256 armor;
    Classes class;
    uint256 experience;
    int256 hitPoints;
    int256 intelligence;
    uint256[] inventory;
    uint256 level;
    int256 strength;
}

/**
 * @title BalancePatchV3
 * @notice Deploys V3 balance changes: effects, weapon/armor stat updates,
 *         new items, monster rebalance, Basilisk boss, and spell tuning.
 * @dev Run with:
 *   forge script script/admin/BalancePatchV3.s.sol \
 *     --sig "run(address)" <WORLD_ADDRESS> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract BalancePatchV3 is Script {
    IWorld public world;

    // --- New effect IDs (computed in _createEffects, used by later sections) ---
    bytes32 internal poisonDotId;
    bytes32 internal blindId;
    bytes32 internal weakenId;
    bytes32 internal stupifyId;
    bytes32 internal petrifyingGazeDmgId;
    bytes32 internal venomDotId;

    // --- New item IDs (set during creation, used by monster updates) ---
    uint256 internal direRatBiteId;
    uint256 internal basiliskFangId;
    uint256 internal basiliskGazeId;

    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("=== BalancePatchV3 ===");

        _createEffects();
        _updateWeapons();
        _createNewWeapons();
        _updateArmor();
        _createNewArmor();
        _updateMonsters();
        _createBasilisk();
        _updateSpells();
        // _renameMonsters() removed — already deployed via RenameV3.s.sol

        vm.stopBroadcast();

        console.log("=== BalancePatchV3 Complete ===");
    }

    // =========================================================================
    //  1. EFFECTS
    // =========================================================================

    function _createEffects() internal {
        console.log("Creating V3 effects...");

        // --- poison_dot (StatusEffect) ---
        poisonDotId = bytes32(bytes8(keccak256(abi.encode("poison_dot"))));
        StatusEffectStats.set(poisonDotId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 3,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(poisonDotId, false);
        StatusEffectValidity.set(poisonDotId, StatusEffectValidityData({
            cooldown: 2, maxStacks: 2, validTime: 0, validTurns: 8
        }));
        Effects.set(poisonDotId, EffectType.StatusEffect, true);
        console.log("  poison_dot deployed");

        // --- blind (StatusEffect) ---
        blindId = bytes32(bytes8(keccak256(abi.encode("blind"))));
        StatusEffectStats.set(blindId, StatusEffectStatsData({
            agiModifier: -8, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: 0
        }));
        StatusEffectTargeting.set(blindId, false);
        StatusEffectValidity.set(blindId, StatusEffectValidityData({
            cooldown: 3, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(blindId, EffectType.StatusEffect, true);
        console.log("  blind deployed");

        // --- weaken (StatusEffect) ---
        weakenId = bytes32(bytes8(keccak256(abi.encode("weaken"))));
        StatusEffectStats.set(weakenId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Strength,
            strModifier: -8
        }));
        StatusEffectTargeting.set(weakenId, false);
        StatusEffectValidity.set(weakenId, StatusEffectValidityData({
            cooldown: 3, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(weakenId, EffectType.StatusEffect, true);
        console.log("  weaken deployed");

        // --- stupify (StatusEffect) ---
        stupifyId = bytes32(bytes8(keccak256(abi.encode("stupify"))));
        StatusEffectStats.set(stupifyId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: -8, resistanceStat: ResistanceStat.Intelligence,
            strModifier: 0
        }));
        StatusEffectTargeting.set(stupifyId, false);
        StatusEffectValidity.set(stupifyId, StatusEffectValidityData({
            cooldown: 3, maxStacks: 1, validTime: 0, validTurns: 8
        }));
        Effects.set(stupifyId, EffectType.StatusEffect, true);
        console.log("  stupify deployed");

        // --- petrifying_gaze_dmg (MagicDamage) ---
        petrifyingGazeDmgId = bytes32(bytes8(keccak256(abi.encode("petrifying_gaze_dmg"))));
        MagicDamageStats.set(petrifyingGazeDmgId, MagicDamageStatsData({
            attackModifierBonus: 0,
            bonusDamage: 0,
            critChanceBonus: 0
        }));
        Effects.set(petrifyingGazeDmgId, EffectType.MagicDamage, true);
        console.log("  petrifying_gaze_dmg deployed");

        // --- venom_dot (StatusEffect) ---
        venomDotId = bytes32(bytes8(keccak256(abi.encode("venom_dot"))));
        StatusEffectStats.set(venomDotId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 5,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectTargeting.set(venomDotId, false);
        StatusEffectValidity.set(venomDotId, StatusEffectValidityData({
            cooldown: 3, maxStacks: 1, validTime: 0, validTurns: 6
        }));
        Effects.set(venomDotId, EffectType.StatusEffect, true);
        console.log("  venom_dot deployed");

        console.log("All V3 effects created");
    }

    // =========================================================================
    //  2. WEAPON UPDATES
    // =========================================================================

    function _updateWeapons() internal {
        console.log("Updating 17 existing weapons...");

        // --- Hunting Bow [30] ---
        {
            WeaponStatsData memory w = WeaponStats.get(30);
            StatRestrictionsData memory r = StatRestrictions.get(30);
            w.hpModifier = 2;
            _writeItem(30, abi.encode(w, r), 0, 0);
        }

        // --- Light Mace [32] (was Steel Mace) ---
        {
            WeaponStatsData memory w = WeaponStats.get(32);
            StatRestrictionsData memory r = StatRestrictions.get(32);
            w.hpModifier = 3;
            r.minStrength = 8;
            r.minAgility = 3;
            _writeItem(32, abi.encode(w, r), 0, 0);
        }

        // --- Shortbow [33] (was Recurve Bow) ---
        {
            WeaponStatsData memory w = WeaponStats.get(33);
            StatRestrictionsData memory r = StatRestrictions.get(33);
            w.hpModifier = 3;
            r.minStrength = 4;
            _writeItem(33, abi.encode(w, r), 0, 0);
        }

        // --- Channeling Rod [34] ---
        {
            WeaponStatsData memory w = WeaponStats.get(34);
            StatRestrictionsData memory r = StatRestrictions.get(34);
            w.hpModifier = 3;
            r.minStrength = 3;
            r.minIntelligence = 9;
            _writeItem(34, abi.encode(w, r), 0, 0);
        }

        // --- Notched Blade [35] (was Etched Blade) ---
        {
            WeaponStatsData memory w = WeaponStats.get(35);
            StatRestrictionsData memory r = StatRestrictions.get(35);
            r.minStrength = 4;
            r.minIntelligence = 4;
            _writeItem(35, abi.encode(w, r), 0, 0);
        }

        // --- Warhammer [36] ---
        {
            WeaponStatsData memory w = WeaponStats.get(36);
            StatRestrictionsData memory r = StatRestrictions.get(36);
            w.hpModifier = 5;
            r.minStrength = 11;
            r.minAgility = 4;
            _writeItem(36, abi.encode(w, r), 0, 0);
        }

        // --- Longbow [37] ---
        {
            WeaponStatsData memory w = WeaponStats.get(37);
            StatRestrictionsData memory r = StatRestrictions.get(37);
            w.maxDamage = 7;
            w.hpModifier = 5;
            r.minStrength = 4;
            r.minAgility = 13;
            _writeItem(37, abi.encode(w, r), 0, 0);
        }

        // --- Mage Staff [38] ---
        {
            WeaponStatsData memory w = WeaponStats.get(38);
            StatRestrictionsData memory r = StatRestrictions.get(38);
            r.minStrength = 4;
            r.minIntelligence = 9;
            _writeItem(38, abi.encode(w, r), 0, 0);
        }

        // --- Dire Rat Fang [39] (was Rat King's Fang) — stats unchanged ---
        // Name is metadata-only, no stat update needed

        // --- Sporecap Wand [40] — NO CHANGE ---

        // --- Notched Cleaver [41] (was Brute's Cleaver) ---
        {
            WeaponStatsData memory w = WeaponStats.get(41);
            StatRestrictionsData memory r = StatRestrictions.get(41);
            w.hpModifier = 2;
            r.minAgility = 3;
            _writeItem(41, abi.encode(w, r), 0, 0);
        }

        // --- Crystal Shard [42] (was Crystal Blade) ---
        {
            WeaponStatsData memory w = WeaponStats.get(42);
            StatRestrictionsData memory r = StatRestrictions.get(42);
            w.minDamage = 4;
            w.maxDamage = 6;
            r.minStrength = 6;
            r.minIntelligence = 6;
            _writeItem(42, abi.encode(w, r), 0, 0);
        }

        // --- Gnarled Cudgel [43] (was Troll's Bonebreaker) ---
        {
            WeaponStatsData memory w = WeaponStats.get(43);
            StatRestrictionsData memory r = StatRestrictions.get(43);
            w.hpModifier = 3;
            r.minStrength = 10;
            r.minAgility = 4;
            _writeItem(43, abi.encode(w, r), 0, 0);
        }

        // --- Webspinner Bow [44] ---
        {
            WeaponStatsData memory w = WeaponStats.get(44);
            StatRestrictionsData memory r = StatRestrictions.get(44);
            w.maxDamage = 5;
            w.hpModifier = 4;
            r.minStrength = 5;
            _writeItem(44, abi.encode(w, r), 0, 0);
        }

        // --- Bone Staff [45] ---
        {
            WeaponStatsData memory w = WeaponStats.get(45);
            StatRestrictionsData memory r = StatRestrictions.get(45);
            w.hpModifier = 5;
            r.minStrength = 4;
            r.minIntelligence = 11;
            _writeItem(45, abi.encode(w, r), 0, 0);
        }

        // --- Stone Maul [46] (was Giant's Club) ---
        {
            WeaponStatsData memory w = WeaponStats.get(46);
            StatRestrictionsData memory r = StatRestrictions.get(46);
            w.maxDamage = 6;
            w.strModifier = 3;
            w.hpModifier = 5;
            r.minStrength = 13;
            r.minAgility = 5;
            _writeItem(46, abi.encode(w, r), 0, 0);
        }

        // --- Darkwood Bow [47] (R4 -> R3) ---
        {
            WeaponStatsData memory w = WeaponStats.get(47);
            StatRestrictionsData memory r = StatRestrictions.get(47);
            w.hpModifier = 6;
            r.minStrength = 4;
            r.minAgility = 14;
            _writeItem(47, abi.encode(w, r), 0, 3); // rarity 4 -> 3
        }

        // --- Smoldering Rod [48] (R4 -> R3) ---
        {
            WeaponStatsData memory w = WeaponStats.get(48);
            StatRestrictionsData memory r = StatRestrictions.get(48);
            w.maxDamage = 7;
            w.hpModifier = 6;
            r.minStrength = 5;
            r.minIntelligence = 13;
            _writeItem(48, abi.encode(w, r), 0, 3); // rarity 4 -> 3
        }

        console.log("All 17 weapons updated");
    }

    // =========================================================================
    //  3. NEW WEAPONS
    // =========================================================================

    function _createNewWeapons() internal {
        console.log("Creating new weapons...");

        // Read base attack effects from starter weapons
        bytes32[] memory physicalEffects = WeaponStats.getEffects(26); // Broken Sword
        bytes32[] memory magicEffects = WeaponStats.getEffects(28);    // Cracked Wand

        StatRestrictionsData memory noRestrictions = StatRestrictionsData({
            minAgility: 0, minIntelligence: 0, minStrength: 0
        });

        // --- Trollhide Cleaver (R4, 350g, physical + weaken) ---
        {
            bytes32[] memory effects = new bytes32[](physicalEffects.length + 1);
            for (uint256 i = 0; i < physicalEffects.length; i++) {
                effects[i] = physicalEffects[i];
            }
            effects[physicalEffects.length] = weakenId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 3, intModifier: 0, hpModifier: 5,
                maxDamage: 9, minDamage: 6, minLevel: 1,
                strModifier: 3, effects: effects
            });
            StatRestrictionsData memory r = StatRestrictionsData({
                minAgility: 13, minIntelligence: 0, minStrength: 16
            });

            uint256 id = world.UD__createItem(
                ItemType.Weapon, 0, 0, 350, 4,
                abi.encode(w, r), "weapon:trollhide_cleaver"
            );
            console.log("  Trollhide Cleaver id:", id);
        }

        // --- Phasefang (R4, 350g, physical + poison_dot + blind) ---
        {
            bytes32[] memory effects = new bytes32[](physicalEffects.length + 2);
            for (uint256 i = 0; i < physicalEffects.length; i++) {
                effects[i] = physicalEffects[i];
            }
            effects[physicalEffects.length] = poisonDotId;
            effects[physicalEffects.length + 1] = blindId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 4, intModifier: 3, hpModifier: 5,
                maxDamage: 10, minDamage: 5, minLevel: 1,
                strModifier: 0, effects: effects
            });
            StatRestrictionsData memory r = StatRestrictionsData({
                minAgility: 16, minIntelligence: 11, minStrength: 0
            });

            uint256 id = world.UD__createItem(
                ItemType.Weapon, 0, 0, 350, 4,
                abi.encode(w, r), "weapon:phasefang"
            );
            console.log("  Phasefang id:", id);
        }

        // --- Drakescale Staff (R4, 350g, magic + stupify) ---
        {
            bytes32[] memory effects = new bytes32[](magicEffects.length + 1);
            for (uint256 i = 0; i < magicEffects.length; i++) {
                effects[i] = magicEffects[i];
            }
            effects[magicEffects.length] = stupifyId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 0, intModifier: 3, hpModifier: 5,
                maxDamage: 8, minDamage: 5, minLevel: 1,
                strModifier: 2, effects: effects
            });
            StatRestrictionsData memory r = StatRestrictionsData({
                minAgility: 0, minIntelligence: 11, minStrength: 16
            });

            uint256 id = world.UD__createItem(
                ItemType.Weapon, 0, 0, 350, 4,
                abi.encode(w, r), "weapon:drakescale_staff"
            );
            console.log("  Drakescale Staff id:", id);
        }

        // --- Monster Weapons (supply=0, dropChance=0, price=0, rarity=0) ---

        // Dire Rat Bite (physical + poison_dot)
        {
            bytes32[] memory effects = new bytes32[](physicalEffects.length + 1);
            for (uint256 i = 0; i < physicalEffects.length; i++) {
                effects[i] = physicalEffects[i];
            }
            effects[physicalEffects.length] = poisonDotId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 0, intModifier: 0, hpModifier: 0,
                maxDamage: 4, minDamage: 2, minLevel: 0,
                strModifier: 0, effects: effects
            });

            direRatBiteId = world.UD__createItem(
                ItemType.Weapon, 0, 0, 0, 0,
                abi.encode(w, noRestrictions), "weapon:dire_rat_bite"
            );
            console.log("  Dire Rat Bite id:", direRatBiteId);
        }

        // Basilisk Fang (physical + venom_dot)
        {
            bytes32[] memory effects = new bytes32[](physicalEffects.length + 1);
            for (uint256 i = 0; i < physicalEffects.length; i++) {
                effects[i] = physicalEffects[i];
            }
            effects[physicalEffects.length] = venomDotId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 0, intModifier: 0, hpModifier: 0,
                maxDamage: 8, minDamage: 5, minLevel: 0,
                strModifier: 0, effects: effects
            });

            basiliskFangId = world.UD__createItem(
                ItemType.Weapon, 0, 0, 0, 0,
                abi.encode(w, noRestrictions), "weapon:basilisk_fang"
            );
            console.log("  Basilisk Fang id:", basiliskFangId);
        }

        // Basilisk Gaze (magic + petrifying_gaze_dmg)
        {
            bytes32[] memory effects = new bytes32[](magicEffects.length + 1);
            for (uint256 i = 0; i < magicEffects.length; i++) {
                effects[i] = magicEffects[i];
            }
            effects[magicEffects.length] = petrifyingGazeDmgId;

            WeaponStatsData memory w = WeaponStatsData({
                agiModifier: 0, intModifier: 0, hpModifier: 0,
                maxDamage: 10, minDamage: 6, minLevel: 0,
                strModifier: 0, effects: effects
            });

            basiliskGazeId = world.UD__createItem(
                ItemType.Weapon, 0, 0, 0, 0,
                abi.encode(w, noRestrictions), "weapon:basilisk_gaze"
            );
            console.log("  Basilisk Gaze id:", basiliskGazeId);
        }

        console.log("All new weapons created");
    }

    // =========================================================================
    //  4. ARMOR UPDATES
    // =========================================================================

    function _updateArmor() internal {
        console.log("Updating 10 existing armor pieces...");

        // --- Studded Leather [16] price 35 -> 40 ---
        {
            ArmorStatsData memory a = ArmorStats.get(16);
            StatRestrictionsData memory r = StatRestrictions.get(16);
            _writeItem(16, abi.encode(a, r), 40, 0);
        }

        // --- Scout Armor [17] price 35 -> 40 ---
        {
            ArmorStatsData memory a = ArmorStats.get(17);
            StatRestrictionsData memory r = StatRestrictions.get(17);
            _writeItem(17, abi.encode(a, r), 40, 0);
        }

        // --- Acolyte Vestments [18] price 35 -> 40 ---
        {
            ArmorStatsData memory a = ArmorStats.get(18);
            StatRestrictionsData memory r = StatRestrictions.get(18);
            _writeItem(18, abi.encode(a, r), 40, 0);
        }

        // --- Etched Chainmail [19] (was Chainmail Shirt) intReq 0->7, price 80->100 ---
        {
            ArmorStatsData memory a = ArmorStats.get(19);
            StatRestrictionsData memory r = StatRestrictions.get(19);
            r.minIntelligence = 7;
            _writeItem(19, abi.encode(a, r), 100, 0);
        }

        // --- Ranger Leathers [20] intReq 0->8, price 80->100 ---
        {
            ArmorStatsData memory a = ArmorStats.get(20);
            StatRestrictionsData memory r = StatRestrictions.get(20);
            r.minIntelligence = 8;
            _writeItem(20, abi.encode(a, r), 100, 0);
        }

        // --- Mage Robes [21] agiReq 0->10, price 80->100 ---
        {
            ArmorStatsData memory a = ArmorStats.get(21);
            StatRestrictionsData memory r = StatRestrictions.get(21);
            r.minAgility = 10;
            _writeItem(21, abi.encode(a, r), 100, 0);
        }

        // --- Spider Silk Wraps [22] intReq 0->8 ---
        {
            ArmorStatsData memory a = ArmorStats.get(22);
            StatRestrictionsData memory r = StatRestrictions.get(22);
            r.minIntelligence = 8;
            _writeItem(22, abi.encode(a, r), 0, 0);
        }

        // --- Carved Stone Plate [23] (was Cracked Stone Plate) ARM 8->10, hpMod 8->10, intReq 0->9 ---
        {
            ArmorStatsData memory a = ArmorStats.get(23);
            StatRestrictionsData memory r = StatRestrictions.get(23);
            a.armorModifier = 10;
            a.hpModifier = 10;
            r.minIntelligence = 9;
            _writeItem(23, abi.encode(a, r), 0, 0);
        }

        // --- Stalker's Cloak [24] ARM 5->7, intReq 0->10 ---
        {
            ArmorStatsData memory a = ArmorStats.get(24);
            StatRestrictionsData memory r = StatRestrictions.get(24);
            a.armorModifier = 7;
            r.minIntelligence = 10;
            _writeItem(24, abi.encode(a, r), 0, 0);
        }

        // --- Scorched Scale Vest [25] intReq 0->9, price 300->250 ---
        {
            ArmorStatsData memory a = ArmorStats.get(25);
            StatRestrictionsData memory r = StatRestrictions.get(25);
            r.minIntelligence = 9;
            _writeItem(25, abi.encode(a, r), 250, 0);
        }

        console.log("All 10 armor pieces updated");
    }

    // =========================================================================
    //  5. NEW ARMOR
    // =========================================================================

    function _createNewArmor() internal {
        console.log("Creating new armor...");

        // Drake's Cowl (R3, 200g, Cloth)
        ArmorStatsData memory a = ArmorStatsData({
            agiModifier: 0,
            armorModifier: 6,
            hpModifier: 0,
            intModifier: 5,
            minLevel: 1,
            strModifier: 0,
            armorType: ArmorType.Cloth
        });
        StatRestrictionsData memory r = StatRestrictionsData({
            minAgility: 12, minIntelligence: 14, minStrength: 0
        });

        uint256 id = world.UD__createItem(
            ItemType.Armor, 0, 0, 200, 3,
            abi.encode(a, r), "armor:drakes_cowl"
        );
        console.log("  Drake's Cowl id:", id);
    }

    // =========================================================================
    //  6. MONSTER UPDATES
    // =========================================================================

    function _updateMonsters() internal {
        console.log("Updating 10 existing monsters...");

        // Mob 1: Dire Rat (L1) — also prepend direRatBiteId to inventory
        {
            uint256[] memory oldInv = _getExistingInventory(1);
            uint256 existingXp = _getExistingXp(1);
            uint256[] memory newInv = new uint256[](oldInv.length + 1);
            newInv[0] = direRatBiteId;
            for (uint256 i = 0; i < oldInv.length; i++) {
                newInv[i + 1] = oldInv[i];
            }
            _updateMob(1, MonsterStats({
                agility: 6, armor: 0, class: Classes.Rogue,
                experience: existingXp, hasBossAI: false, hitPoints: 10, intelligence: 2,
                inventory: newInv, level: 1, strength: 3
            }));
        }

        // Mob 2: Fungal Shaman (L2)
        _updateMob(2, MonsterStats({
            agility: 4, armor: 0, class: Classes.Mage,
            experience: _getExistingXp(2), hasBossAI: false, hitPoints: 12, intelligence: 8,
            inventory: _getExistingInventory(2), level: 2, strength: 3
        }));

        // Mob 3: Cavern Brute (L3)
        _updateMob(3, MonsterStats({
            agility: 4, armor: 1, class: Classes.Warrior,
            experience: _getExistingXp(3), hasBossAI: false, hitPoints: 18, intelligence: 3,
            inventory: _getExistingInventory(3), level: 3, strength: 9
        }));

        // Mob 4: Crystal Elemental (L4)
        _updateMob(4, MonsterStats({
            agility: 5, armor: 1, class: Classes.Mage,
            experience: _getExistingXp(4), hasBossAI: false, hitPoints: 16, intelligence: 10,
            inventory: _getExistingInventory(4), level: 4, strength: 4
        }));

        // Mob 5: Ironhide Troll (L5)
        _updateMob(5, MonsterStats({
            agility: 6, armor: 2, class: Classes.Warrior,
            experience: _getExistingXp(5), hasBossAI: false, hitPoints: 26, intelligence: 5,
            inventory: _getExistingInventory(5), level: 5, strength: 11
        }));

        // Mob 6: Phase Spider (L6)
        _updateMob(6, MonsterStats({
            agility: 12, armor: 0, class: Classes.Rogue,
            experience: _getExistingXp(6), hasBossAI: false, hitPoints: 22, intelligence: 5,
            inventory: _getExistingInventory(6), level: 6, strength: 8
        }));

        // Mob 7: Bonecaster (L7)
        _updateMob(7, MonsterStats({
            agility: 7, armor: 0, class: Classes.Mage,
            experience: _getExistingXp(7), hasBossAI: false, hitPoints: 26, intelligence: 13,
            inventory: _getExistingInventory(7), level: 7, strength: 6
        }));

        // Mob 8: Rock Golem (L8)
        _updateMob(8, MonsterStats({
            agility: 8, armor: 3, class: Classes.Warrior,
            experience: _getExistingXp(8), hasBossAI: false, hitPoints: 38, intelligence: 7,
            inventory: _getExistingInventory(8), level: 8, strength: 14
        }));

        // Mob 9: Pale Stalker (L9)
        _updateMob(9, MonsterStats({
            agility: 15, armor: 0, class: Classes.Rogue,
            experience: _getExistingXp(9), hasBossAI: false, hitPoints: 34, intelligence: 7,
            inventory: _getExistingInventory(9), level: 9, strength: 10
        }));

        // Mob 10: Dusk Drake (L10)
        _updateMob(10, MonsterStats({
            agility: 13, armor: 2, class: Classes.Mage,
            experience: _getExistingXp(10), hasBossAI: false, hitPoints: 52, intelligence: 15,
            inventory: _getExistingInventory(10), level: 10, strength: 13
        }));

        console.log("All 10 monsters updated");
    }

    // =========================================================================
    //  7. BASILISK
    // =========================================================================

    function _createBasilisk() internal {
        console.log("Creating Basilisk boss...");

        uint256[] memory inv = new uint256[](2);
        inv[0] = basiliskFangId;
        inv[1] = basiliskGazeId;

        MonsterStats memory stats = MonsterStats({
            agility: 12, armor: 4, class: Classes.Warrior,
            experience: 10000, hasBossAI: true, hitPoints: 100, intelligence: 10,
            inventory: inv, level: 10, strength: 20
        });

        // Direct table writes (bypasses MobSystem to avoid memory panic in nested calls)
        uint256 mobId = Counters.getCounter(address(world), 0) + 1;
        Counters.setCounter(address(world), 0, mobId);
        Mobs.set(mobId, MobType.Monster, abi.encode(stats), "monster:basilisk");
        MobsByLevel.pushMobIds(stats.level, mobId);

        console.log("  Basilisk mobId:", mobId);
    }

    // =========================================================================
    //  8. SPELL UPDATES
    // =========================================================================

    function _updateSpells() internal {
        console.log("Updating 9 spells...");

        // Effect IDs for spell scaling
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

        // --- 8a. Weapon damage updates via adminUpdateItemStats ---

        // Battle Cry (Warrior) — AdvancedClass enum: Warrior=3
        _updateSpellWeaponDamage(AdvancedClass.Warrior, 4, 8);

        // Divine Shield (Paladin) — AdvancedClass enum: Paladin=1
        _updateSpellWeaponDamage(AdvancedClass.Paladin, 3, 7);

        // Arcane Surge (Sorcerer) — AdvancedClass enum: Sorcerer=2
        _updateSpellWeaponDamage(AdvancedClass.Sorcerer, 4, 8);

        // Hunter's Mark (Ranger) — AdvancedClass enum: Ranger=6
        _updateSpellWeaponDamage(AdvancedClass.Ranger, 3, 7);

        // Shadowstep (Rogue) — AdvancedClass enum: Rogue=9
        _updateSpellWeaponDamage(AdvancedClass.Rogue, 4, 8);

        // Entangle (Druid) — AdvancedClass enum: Druid=4
        _updateSpellWeaponDamage(AdvancedClass.Druid, 3, 6);

        // Soul Drain (Warlock) — AdvancedClass enum: Warlock=5
        _updateSpellWeaponDamage(AdvancedClass.Warlock, 4, 8);

        // Arcane Blast (Wizard) — AdvancedClass enum: Wizard=8
        _updateSpellWeaponDamage(AdvancedClass.Wizard, 5, 10);

        // Blessing (Cleric) — AdvancedClass enum: Cleric=7
        _updateSpellWeaponDamage(AdvancedClass.Cleric, 0, 0);

        // --- 8b. Spell scaling (direct table writes — adminSetSpellScaling not registered on beta) ---
        SpellScaling.set(battleCryId, ResistanceStat.Strength);
        SpellScaling.set(divineShieldId, ResistanceStat.Strength);
        SpellScaling.set(huntersMarkId, ResistanceStat.Agility);
        SpellScaling.set(shadowstepId, ResistanceStat.Agility);
        SpellScaling.set(entangleId, ResistanceStat.Intelligence);
        SpellScaling.set(soulDrainDmgId, ResistanceStat.Intelligence);
        SpellScaling.set(soulDrainCurseId, ResistanceStat.Intelligence);
        SpellScaling.set(arcaneSurgeDmgId, ResistanceStat.Intelligence);
        SpellScaling.set(arcaneBlastDmgId, ResistanceStat.Intelligence);
        SpellScaling.set(blessingId, ResistanceStat.None);
        console.log("  Spell scaling set");

        // --- 8c. Status effect flat values + durations ---

        // battle_cry: STR+3, ARM+3, 6 turns (was STR+4, ARM+3, 3 turns)
        StatusEffectStats.set(battleCryId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 3, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 3
        }));
        StatusEffectValidity.set(battleCryId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        // divine_shield: STR+3, ARM+5, 6 turns (was STR+3, ARM+5, 3 turns)
        StatusEffectStats.set(divineShieldId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 5, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 3
        }));
        StatusEffectValidity.set(divineShieldId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        // hunters_mark: AGI-3, ARM-2, 6 turns (was AGI-5, ARM-2, 4 turns)
        StatusEffectStats.set(huntersMarkId, StatusEffectStatsData({
            agiModifier: -3, armorModifier: -2, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: 0
        }));
        StatusEffectValidity.set(huntersMarkId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        // shadowstep: AGI+5, 4 turns (was AGI+8, 2 turns)
        StatusEffectStats.set(shadowstepId, StatusEffectStatsData({
            agiModifier: 5, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectValidity.set(shadowstepId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 4
        }));

        // entangle: AGI-3, STR-2, 6 turns (was AGI-5, STR-3, 3 turns)
        StatusEffectStats.set(entangleId, StatusEffectStatsData({
            agiModifier: -3, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: 0, resistanceStat: ResistanceStat.Agility,
            strModifier: -2
        }));
        StatusEffectValidity.set(entangleId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        // soul_drain_curse: STR-3, INT-3, 5 turns (was STR-3, INT-3, 3 turns)
        StatusEffectStats.set(soulDrainCurseId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 0, damagePerTick: 0,
            hpModifier: 0, intModifier: -3, resistanceStat: ResistanceStat.Intelligence,
            strModifier: -3
        }));
        StatusEffectValidity.set(soulDrainCurseId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 5
        }));

        // blessing: INT+3, ARM+5, HP+4, 6 turns (was INT+3, ARM+5, HP+5, 3 turns)
        StatusEffectStats.set(blessingId, StatusEffectStatsData({
            agiModifier: 0, armorModifier: 5, damagePerTick: 0,
            hpModifier: 4, intModifier: 3, resistanceStat: ResistanceStat.None,
            strModifier: 0
        }));
        StatusEffectValidity.set(blessingId, StatusEffectValidityData({
            cooldown: 0, maxStacks: 1, validTime: 0, validTurns: 6
        }));

        console.log("All 9 spells updated");
    }

    // =========================================================================
    //  9. MONSTER RENAMES — already deployed via RenameV3.s.sol
    // =========================================================================

    // =========================================================================
    //  HELPERS
    // =========================================================================

    /// @dev Update an existing item's stats. If priceOverride or rarityOverride is non-zero,
    ///      uses that value instead of the existing one.
    function _writeItem(
        uint256 itemId,
        bytes memory stats,
        uint256 priceOverride,
        uint256 rarityOverride
    ) internal {
        ItemsData memory existing = Items.get(itemId);
        uint256 price = priceOverride > 0 ? priceOverride : existing.price;
        uint256 rarity = rarityOverride > 0 ? rarityOverride : existing.rarity;

        world.UD__adminUpdateItemStats(itemId, existing.dropChance, price, rarity, stats);
    }

    /// @dev Read a spell's weapon item ID from AdvancedClassItems, then update its damage.
    function _updateSpellWeaponDamage(
        AdvancedClass advancedClass,
        int256 minDmg,
        int256 maxDmg
    ) internal {
        uint256[] memory itemIds = AdvancedClassItems.getItemIds(advancedClass);
        uint256 spellItemId = itemIds[0];

        WeaponStatsData memory w = WeaponStats.get(spellItemId);
        StatRestrictionsData memory r = StatRestrictions.get(spellItemId);
        w.minDamage = minDmg;
        w.maxDamage = maxDmg;
        _writeItem(spellItemId, abi.encode(w, r), 0, 0);
    }

    function _updateMob(uint256 mobId, MonsterStats memory stats) internal {
        Mobs.setMobStats(mobId, abi.encode(stats));
        console.log("  Updated mob", mobId);
    }

    function _getExistingInventory(uint256 mobId) internal view returns (uint256[] memory) {
        bytes memory existing = Mobs.getMobStats(mobId);
        OldMonsterStats memory old = abi.decode(existing, (OldMonsterStats));
        return old.inventory;
    }

    function _getExistingXp(uint256 mobId) internal view returns (uint256) {
        bytes memory existing = Mobs.getMobStats(mobId);
        OldMonsterStats memory old = abi.decode(existing, (OldMonsterStats));
        return old.experience;
    }
}
