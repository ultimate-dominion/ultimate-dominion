// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IStore} from "@latticexyz/store/src/IStore.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {EncodeArray} from "@latticexyz/store/src/tightcoder/EncodeArray.sol";
import {MobsByZoneLevel} from "@codegen/index.sol";
import {MobsByLevel} from "@codegen/index.sol";
import {StarterConsumables} from "@codegen/index.sol";

/**
 * @title FixAccidentalZoneLoad
 * @notice Repairs production state after accidental zone-loader run on 2026-03-30.
 *
 *   Damage caused:
 *     1. MobsByZoneLevel(zone=1, level=N) populated with duplicate mob IDs (13-22)
 *     2. MobsByLevel(level=N) had duplicate mob IDs appended (13-23)
 *     3. StarterConsumables overwritten with duplicate item ID 137
 *
 *   Fixes:
 *     1. Clear MobsByZoneLevel entries for zone 1 (restores fallback to MobsByLevel)
 *     2. Truncate MobsByLevel arrays to remove duplicates (keep originals: 1-10)
 *     3. Restore StarterConsumables to original item ID 56 (Minor Health Potion)
 *
 *   Usage:
 *     PRIVATE_KEY=0x... FOUNDRY_PROFILE=script forge script \
 *       script/admin/FixAccidentalZoneLoad.s.sol \
 *       --sig "run(address)" <worldAddress> \
 *       --broadcast --rpc-url $RPC_URL
 */
contract FixAccidentalZoneLoad is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        IStore store = IStore(_worldAddress);

        console.log("=== Fix Accidental Zone Load (2026-03-30) ===");
        console.log("World:", _worldAddress);

        // ── Verify current state before fixing ──
        // Check MobsByZoneLevel(zone=1, level=1) has the duplicate mob ID 13
        ResourceId mbzlTableId = MobsByZoneLevel._tableId;
        bytes32[] memory zl1Key = new bytes32[](2);
        zl1Key[0] = bytes32(uint256(1)); // zone 1
        zl1Key[1] = bytes32(uint256(1)); // level 1
        bytes memory currentData = store.getDynamicField(mbzlTableId, zl1Key, 0);
        require(currentData.length > 0, "MobsByZoneLevel(1,1) is already empty - nothing to fix");
        console.log("  Verified: MobsByZoneLevel(1,1) has data (length: %d)", currentData.length);

        // Check StarterConsumables has the duplicate item ID 137
        ResourceId scTableId = StarterConsumables._tableId;
        bytes32[] memory emptyKey = new bytes32[](0);
        bytes memory scData = store.getDynamicField(scTableId, emptyKey, 0);
        console.log("  StarterConsumables itemIds length: %d bytes", scData.length);

        vm.startBroadcast(deployerPrivateKey);

        // ── Fix 1: Clear MobsByZoneLevel for zone 1 ──
        console.log("\n--- Fix 1: Clear MobsByZoneLevel(zone=1) ---");
        uint256[11] memory levels = [uint256(1), 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
        bytes memory emptyArray = new bytes(0);

        for (uint256 i = 0; i < levels.length; i++) {
            bytes32[] memory keyTuple = new bytes32[](2);
            keyTuple[0] = bytes32(uint256(1)); // zone 1
            keyTuple[1] = bytes32(levels[i]);
            store.setDynamicField(mbzlTableId, keyTuple, 0, emptyArray);
            console.log("  Cleared zone=1 level=%d", levels[i]);
        }

        // ── Fix 2: Truncate MobsByLevel to remove duplicates ──
        console.log("\n--- Fix 2: Truncate MobsByLevel (remove duplicates) ---");
        ResourceId mblTableId = MobsByLevel._tableId;

        // Original mob IDs per level (from pre-accident state):
        // Levels 1-10 each had ONE original mob. Level 12 had NONE (boss handled separately).
        // The accidental run appended duplicates. We truncate to keep only originals.
        uint256[10] memory originalMobs = [uint256(1), 2, 3, 4, 5, 6, 7, 8, 9, 10];

        for (uint256 i = 0; i < 10; i++) {
            bytes32[] memory levelKey = new bytes32[](1);
            levelKey[0] = bytes32(uint256(i + 1)); // levels 1-10

            // Set to single-element array with original mob ID
            uint256[] memory singleMob = new uint256[](1);
            singleMob[0] = originalMobs[i];
            bytes memory encoded = EncodeArray.encode(singleMob);
            store.setDynamicField(mblTableId, levelKey, 0, encoded);
            console.log("  Level %d: set to [%d]", i + 1, originalMobs[i]);
        }

        // Level 12: clear entirely (boss not in MobsByLevel originally)
        {
            bytes32[] memory level12Key = new bytes32[](1);
            level12Key[0] = bytes32(uint256(12));
            store.setDynamicField(mblTableId, level12Key, 0, emptyArray);
            console.log("  Level 12: cleared (boss handled via ZoneBossConfig)");
        }

        // ── Fix 3: Restore StarterConsumables ──
        console.log("\n--- Fix 3: Restore StarterConsumables ---");
        // Original: item ID 56 (Minor Health Potion), amount 3
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 56;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3;

        // Dynamic field 0 = itemIds, field 1 = amounts
        store.setDynamicField(scTableId, emptyKey, 0, EncodeArray.encode(itemIds));
        store.setDynamicField(scTableId, emptyKey, 1, EncodeArray.encode(amounts));
        console.log("  Set itemIds=[56], amounts=[3]");

        vm.stopBroadcast();

        console.log("\n=== Fix Complete ===");
        console.log("  MobsByZoneLevel(zone=1): cleared 11 entries");
        console.log("  MobsByLevel: restored 10 levels to original mob IDs");
        console.log("  StarterConsumables: restored to item 56 (Minor Health Potion x3)");
    }
}
