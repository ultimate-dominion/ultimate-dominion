// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";
import {Mobs, MobDropBonus} from "@codegen/index.sol";
import {MonsterStats} from "@interfaces/Structs.sol";

/**
 * @title SetMobDropBonusesZ2
 * @notice MobDropBonus parallel arrays for Windy Peaks (Zone 2) monsters.
 *         Mirrors Z1 journey curve: no bonus at onboarding, +300 journey bump
 *         at mid-game, +100 taper at endgame, boss piñata at Warden.
 *
 * UNIFIED BASE RATES (items.json): R1=4000, R2=1500, R3=200, R4=30
 *
 * L11-L13: R1 only, no bonuses (4% base is generous for onboarding)
 * L14-L16: R2 signature items get +300 journey bump (1500→1800 = 1.8%)
 * L17-L19: R3 signature items get +100 taper (200→300 = 0.3%)
 * L20 Warden: Boss piñata (R3 effective 15000 = 15%, R4 effective 5000 = 5%)
 *
 * MUST run AFTER zone-loader has registered Z2 monsters.
 * Verify mob IDs match on-chain before deploying.
 *
 * Usage:
 *   forge script script/admin/SetMobDropBonusesZ2.s.sol \
 *     --sig "run(address,uint256)" <WORLD_ADDRESS> <FIRST_Z2_MOB_ID> \
 *     --rpc-url <RPC> --broadcast --skip-simulation
 */
contract SetMobDropBonusesZ2 is Script {
    function run(address worldAddress, uint256 startMobId) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        StoreSwitch.setStoreAddress(worldAddress);

        console.log("=== SetMobDropBonusesZ2 ===");
        console.log("Starting mob ID:", startMobId);

        // Z2 has 10 monsters in order: Ridge Stalker(L11) through Korrath's Warden(L20)
        for (uint256 i = 0; i < 10; i++) {
            uint256 mobId = startMobId + i;
            uint256[] memory bonuses = _getBonuses(i, mobId);
            MobDropBonus.setBonuses(mobId, bonuses);
            console.log("  Mob", mobId, "bonuses set, length:", bonuses.length);
        }

        vm.stopBroadcast();
        console.log("=== SetMobDropBonusesZ2 Complete ===");
    }

    function _getBonuses(uint256 index, uint256 mobId) internal view returns (uint256[] memory) {
        MonsterStats memory stats = abi.decode(Mobs.getMobStats(mobId), (MonsterStats));
        uint256 len = stats.inventory.length;
        uint256[] memory b = new uint256[](len);

        if (index <= 2) return b; // L11-L13: no bonuses
        if (index <= 5) return _midTier(b); // L14-L16: R2 journey bump
        if (index <= 8) return _endgame(b); // L17-L19: R3 taper
        return _warden(b); // L20: boss piñata
    }

    // =========================================================================
    //  L14-L16: Gale Phantom, Blighthorn, Storm Shrike (28 items each)
    //  Inventory layout:
    //    [0] Monster Strike    [1] Ridgestone Hammer(R1)  [2] Peak Cleaver(R2)
    //    [3] Scrub Bow(R1)     [4] Gale Bow(R2)           [5] Frozen Shard(R1)
    //    [6] Rime Staff(R2)    [7] Peakstone Mail(R1)      [8] Ridgeforged Plate(R2)
    //    [9] Mountain Hide(R1) [10] Galebound Leather(R2) [11] Frostweave Robe(R1)
    //    [12] Mistcloak(R2)    [13-21] consumables        [22-27] crafting mats
    //
    //  R2 items at slots 2, 4, 6, 8, 10, 12 get +300 journey bump
    //  Effective: 1500 + 300 = 1800 (1.8%)
    // =========================================================================
    function _midTier(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[2] = 300;   // Peak Cleaver (R2)
        b[4] = 300;   // Gale Bow (R2)
        b[6] = 300;   // Rime Staff (R2)
        b[8] = 300;   // Ridgeforged Plate (R2)
        b[10] = 300;  // Galebound Leather (R2)
        b[12] = 300;  // Mistcloak (R2)
        return b;
    }

    // =========================================================================
    //  L17-L19: Hollow Scout, Ironpeak Charger, Peakfire Wraith (35 items each)
    //  Inventory layout:
    //    [0] Monster Strike     [1] Peak Cleaver(R2)       [2] Windforged Axe(R3)
    //    [3] Gale Bow(R2)       [4] Stormfeather Bow(R3)   [5] Rime Staff(R2)
    //    [6] Stormglass Rod(R3) [7] Warden's Ember(R3)     [8] Windweaver(R3)
    //    [9] Ridgefang(R3)      [10] Viperstrike(R3)       [11] Ashveil Staff(R3)
    //    [12] Ridgeforged(R2)   [13] Windsworn Plate(R3)   [14] Galebound(R2)
    //    [15] Stormhide Vest(R3)[16] Mistcloak(R2)         [17] Wraith Vestments(R3)
    //    [18-28] consumables    [29-34] crafting mats
    //
    //  R3 items at slots 2,4,6,7,8,9,10,11,13,15,17 get +100 taper
    //  Effective: 200 + 100 = 300 (0.3%)
    // =========================================================================
    function _endgame(uint256[] memory b) internal pure returns (uint256[] memory) {
        b[2] = 100;   // Windforged Axe (R3)
        b[4] = 100;   // Stormfeather Bow (R3)
        b[6] = 100;   // Stormglass Rod (R3)
        b[7] = 100;   // Warden's Ember (R3 hybrid)
        b[8] = 100;   // Windweaver (R3 hybrid)
        b[9] = 100;   // Ridgefang (R3 hybrid)
        b[10] = 100;  // Viperstrike (R3 hybrid)
        b[11] = 100;  // Ashveil Staff (R3 hybrid)
        b[13] = 100;  // Windsworn Plate (R3)
        b[15] = 100;  // Stormhide Vest (R3)
        b[17] = 100;  // Wraith Vestments (R3)
        return b;
    }

    // =========================================================================
    //  L20: Korrath's Warden (34 items, hasBossAI=true)
    //  Inventory layout:
    //    [0] Warden Strike      [1] Windforged Axe(R3)     [2] Warden's Maul(R4)
    //    [3] Stormfeather(R3)   [4] Peakwind Longbow(R4)   [5] Stormglass Rod(R3)
    //    [6] Wraith Beacon(R4)  [7] Warden's Ember(R3)     [8] Windweaver(R3)
    //    [9] Ridgefang(R3)      [10] Viperstrike(R3)       [11] Ashveil Staff(R3)
    //    [12] Windsworn Plate(R3)[13] Warden's Bulwark(R4) [14] Stormhide Vest(R3)
    //    [15] Phantom Shroud(R4)[16] Wraith Vestments(R3)  [17] Ember Mantle(R4)
    //    [18-28] consumables    [29-34] crafting mats
    //
    //  R3 gear: base 200 + 14800 = 15000 (15%)
    //  R4 gear: base 30 + 4970 = 5000 (5%)
    //  Consumables: boosted for piñata feel
    // =========================================================================
    function _warden(uint256[] memory b) internal pure returns (uint256[] memory) {
        // R3 gear (effective 15%)
        b[1] = 14800;   // Windforged Axe
        b[3] = 14800;   // Stormfeather Bow
        b[5] = 14800;   // Stormglass Rod
        b[7] = 14800;   // Warden's Ember
        b[8] = 14800;   // Windweaver
        b[9] = 14800;   // Ridgefang
        b[10] = 14800;  // Viperstrike
        b[11] = 14800;  // Ashveil Staff
        b[12] = 14800;  // Windsworn Plate
        b[14] = 14800;  // Stormhide Vest
        b[16] = 14800;  // Wraith Vestments

        // R4 gear (effective 5%)
        b[2] = 4970;    // Warden's Maul
        b[4] = 4970;    // Peakwind Longbow
        b[6] = 4970;    // Wraith Beacon
        b[13] = 4970;   // Warden's Bulwark
        b[15] = 4970;   // Phantom Shroud
        b[17] = 4970;   // Ember Mantle

        // Consumables — generous boss drops
        b[18] = 42000;  // Minor Health Potion (8000+42000 = 50000 = 50%)
        b[19] = 44000;  // Health Potion (6000+44000 = 50000 = 50%)
        b[20] = 42000;  // Greater Health Potion (8000+42000 = 50000 = 50%)
        b[21] = 24000;  // Fortifying Stew (6000+24000 = 30000 = 30%)
        b[22] = 26000;  // Quickening Berries (4000+26000 = 30000 = 30%)
        b[23] = 22000;  // Focusing Tea (8000+22000 = 30000 = 30%)
        b[24] = 20000;  // Bloodrage Tonic
        b[25] = 20000;  // Stoneskin Salve
        b[26] = 20000;  // Trollblood Ale
        b[27] = 20000;  // Venom Vial
        b[28] = 20000;  // Flashpowder

        return b;
    }
}
