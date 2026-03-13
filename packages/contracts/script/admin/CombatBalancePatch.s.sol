// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Items,
    ItemsData,
    Mobs,
    WeaponStats,
    WeaponStatsData,
    StatRestrictions,
    StatRestrictionsData,
    StatusEffectStats,
    StatusEffectStatsData,
    StatusEffectValidity,
    StatusEffectValidityData,
    BossSpawnConfig,
    MobsByLevel
} from "@codegen/index.sol";
import {ResistanceStat, Classes} from "@codegen/common.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {ERC1155URIStorage} from "@erc1155/tables/ERC1155URIStorage.sol";
import {_erc1155URIStorageTableId} from "@erc1155/utils.sol";
import {ITEMS_NAMESPACE} from "../../constants.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";

/**
 * @title CombatBalancePatch
 * @notice Final balance patch before launch: Basilisk stat tuning, weapon/effect data changes,
 *         boss spawn config. Run IMMEDIATELY after system upgrade (pnpm deploy:mainnet).
 *
 * Usage:
 *   source .env.mainnet && forge script script/admin/CombatBalancePatch.s.sol \
 *     --tc CombatBalancePatch --sig "run(address)" $WORLD_ADDRESS \
 *     --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract CombatBalancePatch is Script {
    IWorld public world;
    ResourceId internal uriTableId;

    // Resolved item IDs
    uint256 internal basiliskFangsId;
    uint256 internal petrifyingGazeId;
    uint256 internal phasefangId;
    uint256 internal drakescaleStaffId;
    uint256 internal stalkersVestId; // was Stalker's Cloak

    // Basilisk mob ID (resolved from MobsByLevel or known)
    uint256 constant BASILISK_MOB_ID = 12;

    // Effect IDs (deterministic from keccak256)
    bytes32 internal venomDotId = bytes32(bytes8(keccak256(abi.encode("venom_dot"))));
    bytes32 internal poisonDotId = bytes32(bytes8(keccak256(abi.encode("poison_dot"))));
    bytes32 internal blindId = bytes32(bytes8(keccak256(abi.encode("blind"))));

    function run(address worldAddress) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);
        uriTableId = _erc1155URIStorageTableId(ITEMS_NAMESPACE);

        console.log("=== CombatBalancePatch ===");

        _resolveItemIds(worldAddress);
        _updateBasiliskStats();
        _updateWeapons();
        _updateStatusEffects();
        _configureBossSpawn();

        vm.stopBroadcast();
        console.log("=== CombatBalancePatch Complete ===");
    }

    // =========================================================================
    //  RESOLVE ITEM IDS
    // =========================================================================

    function _resolveItemIds(address worldAddress) internal {
        console.log("Resolving item IDs...");
        uint256 total = IWorld(worldAddress).UD__getCurrentItemsCounter();

        for (uint256 i = 1; i <= total; i++) {
            string memory uri = ERC1155URIStorage.getUri(uriTableId, i);
            bytes32 h = keccak256(bytes(uri));

            if (h == keccak256("weapon:basilisk_fangs") || h == keccak256("weapon:basilisk_fang") || h == keccak256("basilisk_fang")) {
                basiliskFangsId = i;
            } else if (h == keccak256("weapon:petrifying_gaze") || h == keccak256("weapon:basilisk_gaze") || h == keccak256("basilisk_gaze")) {
                petrifyingGazeId = i;
            } else if (h == keccak256("weapon:phasefang") || h == keccak256("phasefang")) {
                phasefangId = i;
            } else if (h == keccak256("weapon:drakescale_staff") || h == keccak256("drakescale_staff")) {
                drakescaleStaffId = i;
            } else if (h == keccak256("armor:stalkers_cloak")) {
                stalkersVestId = i;
            }
        }

        require(basiliskFangsId != 0, "basiliskFangs not found");
        require(petrifyingGazeId != 0, "petrifyingGaze not found");
        require(phasefangId != 0, "phasefang not found");
        require(drakescaleStaffId != 0, "drakescaleStaff not found");
        require(stalkersVestId != 0, "stalkersVest not found");

        console.log("  basiliskFangs:", basiliskFangsId);
        console.log("  petrifyingGaze:", petrifyingGazeId);
        console.log("  phasefang:", phasefangId);
        console.log("  drakescaleStaff:", drakescaleStaffId);
        console.log("  stalkersVest:", stalkersVestId);
    }

    // =========================================================================
    //  BASILISK STATS
    // =========================================================================

    function _updateBasiliskStats() internal {
        console.log("Updating Basilisk stats (mobId %d)...", BASILISK_MOB_ID);

        MonsterStats memory stats = abi.decode(Mobs.getMobStats(BASILISK_MOB_ID), (MonsterStats));

        // STR 20→17, HP 100→130, Level 10→12
        stats.strength = 17;
        stats.hitPoints = 130;
        stats.level = 12;

        Mobs.setMobStats(BASILISK_MOB_ID, abi.encode(stats));
        console.log("  STR=17, HP=130, Level=12");
    }

    // =========================================================================
    //  WEAPON UPDATES
    // =========================================================================

    function _updateWeapons() internal {
        console.log("Updating weapons...");

        // --- Basilisk Fangs: dmg → 3-5 ---
        {
            WeaponStatsData memory w = WeaponStats.get(basiliskFangsId);
            StatRestrictionsData memory r = StatRestrictions.get(basiliskFangsId);
            w.minDamage = 3;
            w.maxDamage = 5;
            _writeItem(basiliskFangsId, abi.encode(w, r));
            console.log("  Basilisk Fangs: dmg 3-5");
        }

        // --- Petrifying Gaze: dmg → 8-14 ---
        {
            WeaponStatsData memory w = WeaponStats.get(petrifyingGazeId);
            StatRestrictionsData memory r = StatRestrictions.get(petrifyingGazeId);
            w.minDamage = 8;
            w.maxDamage = 14;
            _writeItem(petrifyingGazeId, abi.encode(w, r));
            console.log("  Petrifying Gaze: dmg 8-14");
        }

        // --- Phasefang: dmg 4-8, convert physical→magic ---
        {
            WeaponStatsData memory w = WeaponStats.get(phasefangId);
            StatRestrictionsData memory r = StatRestrictions.get(phasefangId);
            w.minDamage = 4;
            w.maxDamage = 8;

            // Swap effects[0] from physical (item 26) to magic (item 28)
            bytes32[] memory magicEffects = WeaponStats.getEffects(28); // Cracked Wand
            bytes32[] memory newEffects = new bytes32[](w.effects.length);
            // Replace physical attack effect at [0] with magic attack effect
            newEffects[0] = magicEffects[0];
            // Keep remaining effects (poison_dot, blind)
            for (uint256 i = 1; i < w.effects.length; i++) {
                newEffects[i] = w.effects[i];
            }
            w.effects = newEffects;

            _writeItem(phasefangId, abi.encode(w, r));
            console.log("  Phasefang: dmg 4-8, physical->magic");
        }

        // --- Drakescale Staff: minSTR 16→12 ---
        {
            WeaponStatsData memory w = WeaponStats.get(drakescaleStaffId);
            StatRestrictionsData memory r = StatRestrictions.get(drakescaleStaffId);
            r.minStrength = 12;
            _writeItem(drakescaleStaffId, abi.encode(w, r));
            console.log("  Drakescale Staff: minSTR=12");
        }

        // --- Stalker's Vest (was Cloak): minINT 10→8 ---
        {
            // Armor uses ArmorStats, not WeaponStats — use raw adminUpdateItemStats
            ItemsData memory existing = Items.get(stalkersVestId);
            // Decode existing stats, modify minINT, re-encode
            // ArmorStats + StatRestrictions are encoded together in item stats
            StatRestrictionsData memory r = StatRestrictions.get(stalkersVestId);
            r.minIntelligence = 8;
            StatRestrictions.set(stalkersVestId, r);
            console.log("  Stalker's Vest: minINT=8");
        }
    }

    // =========================================================================
    //  STATUS EFFECTS
    // =========================================================================

    function _updateStatusEffects() internal {
        console.log("Updating status effects...");

        // --- venom_dot: damagePerTick 5→4 ---
        {
            StatusEffectStatsData memory s = StatusEffectStats.get(venomDotId);
            s.damagePerTick = 4;
            StatusEffectStats.set(venomDotId, s);
            console.log("  venom_dot: damagePerTick=4");
        }

        // --- poison_dot: damagePerTick 3→1, maxStacks 2→1 ---
        {
            StatusEffectStatsData memory s = StatusEffectStats.get(poisonDotId);
            s.damagePerTick = 1;
            StatusEffectStats.set(poisonDotId, s);

            StatusEffectValidityData memory v = StatusEffectValidity.get(poisonDotId);
            v.maxStacks = 1;
            StatusEffectValidity.set(poisonDotId, v);
            console.log("  poison_dot: damagePerTick=1, maxStacks=1");
        }

        // --- blind: agiModifier -8→-5 ---
        {
            StatusEffectStatsData memory s = StatusEffectStats.get(blindId);
            s.agiModifier = -5;
            StatusEffectStats.set(blindId, s);
            console.log("  blind: agiModifier=-5");
        }
    }

    // =========================================================================
    //  BOSS SPAWN CONFIG
    // =========================================================================

    function _configureBossSpawn() internal {
        console.log("Configuring boss spawn...");

        // Remove Basilisk from MobsByLevel[10] (was added at level 10 in V3)
        uint256[] memory level10Mobs = MobsByLevel.getMobIds(10);
        uint256 newLen;
        for (uint256 i; i < level10Mobs.length; i++) {
            if (level10Mobs[i] != BASILISK_MOB_ID) {
                level10Mobs[newLen] = level10Mobs[i];
                newLen++;
            }
        }

        if (newLen < level10Mobs.length) {
            uint256[] memory trimmed = new uint256[](newLen);
            for (uint256 i; i < newLen; i++) {
                trimmed[i] = level10Mobs[i];
            }
            MobsByLevel.setMobIds(10, trimmed);
            console.log("  Removed Basilisk from MobsByLevel[10], remaining:", newLen);
        } else {
            console.log("  Basilisk not found in MobsByLevel[10], skipping");
        }

        // Also remove from MobsByLevel[12] if it was re-added at new level
        uint256[] memory level12Mobs = MobsByLevel.getMobIds(12);
        newLen = 0;
        bool foundIn12 = false;
        for (uint256 i; i < level12Mobs.length; i++) {
            if (level12Mobs[i] != BASILISK_MOB_ID) {
                level12Mobs[newLen] = level12Mobs[i];
                newLen++;
            } else {
                foundIn12 = true;
            }
        }
        if (foundIn12) {
            uint256[] memory trimmed12 = new uint256[](newLen);
            for (uint256 i; i < newLen; i++) {
                trimmed12[i] = level12Mobs[i];
            }
            MobsByLevel.setMobIds(12, trimmed12);
            console.log("  Removed Basilisk from MobsByLevel[12]");
        }

        // Set BossSpawnConfig
        uint256 spawnChanceBp = 2; // ~1.3 spawns/day at 10 concurrent players
        BossSpawnConfig.set(BASILISK_MOB_ID, spawnChanceBp);
        console.log("  BossSpawnConfig set: mobId=%d, chanceBp=%d", BASILISK_MOB_ID, spawnChanceBp);
    }

    // =========================================================================
    //  HELPERS
    // =========================================================================

    function _writeItem(uint256 itemId, bytes memory stats) internal {
        ItemsData memory existing = Items.get(itemId);
        world.UD__adminUpdateItemStats(itemId, existing.dropChance, existing.price, existing.rarity, stats);
    }
}
