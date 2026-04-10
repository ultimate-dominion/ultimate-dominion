// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {IStore} from "@latticexyz/store/src/IStore.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {Items} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

/**
 * @title MigrateSpellItemType
 * @notice Fixes spell items that were deployed as ItemType.Weapon instead of
 *         ItemType.Spell. Updates the Items table itemType field.
 *
 * The deploy scripts created spells with ItemType.Weapon across multiple runs:
 *   - Items 1-9: L10 spells, first deploy (already fixed)
 *   - Items 10-24: duplicate deploys (no players own these)
 *   - Item 214: Battle Cry from production deploy
 *   - Items 232-257: L10+L15 spells from production deploy (player-owned)
 *   - Items 551-559: L15 spells (already correct)
 *
 * Usage:
 *   FOUNDRY_PROFILE=script forge script MigrateSpellItemType --broadcast --sig "run(address)" <WORLD_ADDRESS>
 */
contract MigrateSpellItemType is Script {
    function run(address _worldAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        IStore store = IStore(_worldAddress);
        ResourceId tableId = Items._tableId;

        console.log("=== MigrateSpellItemType ===");
        console.log("World:", _worldAddress);

        // All spell item IDs that need migration: the player-owned ones
        // Items 1-9 already migrated, Items 551-559 already correct
        uint256[] memory spellIds = new uint256[](27);
        // Item 214 (Battle Cry from production deploy)
        spellIds[0] = 214;
        // Items 10-24 (duplicate deploys, fix for consistency)
        for (uint256 i = 0; i < 15; i++) {
            spellIds[1 + i] = 10 + i;
        }
        // Items 232-242 (production L10 spells)
        for (uint256 i = 0; i < 11; i++) {
            spellIds[16 + i] = 232 + i;
        }

        vm.startBroadcast(deployerPrivateKey);

        uint256 migrated = 0;
        for (uint256 j = 0; j < spellIds.length; j++) {
            uint256 id = spellIds[j];
            bytes32[] memory keyTuple = new bytes32[](1);
            keyTuple[0] = bytes32(id);

            // fieldIndex 0 = itemType (uint8 enum)
            bytes memory rawType = store.getField(tableId, keyTuple, 0);
            uint8 currentType = uint8(rawType[0]);

            if (currentType == uint8(ItemType.Weapon)) {
                store.setField(tableId, keyTuple, 0, abi.encodePacked(uint8(ItemType.Spell)));
                migrated++;
                console.log("  Migrated id", id, "-> Spell");
            } else if (currentType == uint8(ItemType.Spell)) {
                console.log("  SKIP id", id, "- already Spell");
            } else {
                console.log("  SKIP id", id, "- unexpected type, not touching");
            }
        }

        // Also fix items 243-257 (production L15 spells)
        for (uint256 id = 243; id <= 257; id++) {
            bytes32[] memory keyTuple = new bytes32[](1);
            keyTuple[0] = bytes32(id);

            bytes memory rawType = store.getField(tableId, keyTuple, 0);
            uint8 currentType = uint8(rawType[0]);

            if (currentType == uint8(ItemType.Weapon)) {
                store.setField(tableId, keyTuple, 0, abi.encodePacked(uint8(ItemType.Spell)));
                migrated++;
                console.log("  Migrated id", id, "-> Spell");
            } else if (currentType == uint8(ItemType.Spell)) {
                console.log("  SKIP id", id, "- already Spell");
            } else {
                console.log("  SKIP id", id, "- unexpected type, not touching");
            }
        }

        vm.stopBroadcast();

        console.log("=== Migration complete:", migrated, "items updated ===");
    }
}
