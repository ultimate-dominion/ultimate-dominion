// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {IStore} from "@latticexyz/store/src/IStore.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {EncodeArray} from "@latticexyz/store/src/tightcoder/EncodeArray.sol";
import {Items} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

/**
 * @title MigrateSpellItemType
 * @notice Fixes L10 class spells that were deployed as ItemType.Weapon instead of
 *         ItemType.Spell. Updates the Items table itemType field for IDs 1-9.
 *
 * These items are: Battle Cry, Divine Shield, Arcane Surge, Hunter's Mark,
 * Shadowstep, Entangle, Soul Drain, Arcane Blast, Blessing.
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

        string[9] memory spellNames = [
            "Battle Cry",
            "Divine Shield",
            "Arcane Surge",
            "Hunter's Mark",
            "Shadowstep",
            "Entangle",
            "Soul Drain",
            "Arcane Blast",
            "Blessing"
        ];

        vm.startBroadcast(deployerPrivateKey);

        uint256 migrated = 0;
        for (uint256 i = 1; i <= 9; i++) {
            // Read the itemType field (field index 0 in Items schema)
            bytes32[] memory keyTuple = new bytes32[](1);
            keyTuple[0] = bytes32(i);

            // fieldIndex 0 = itemType (uint8 enum)
            bytes memory rawType = store.getField(tableId, keyTuple, 0);
            uint8 currentType = uint8(rawType[0]);

            if (currentType == uint8(ItemType.Weapon)) {
                // Set itemType to Spell (field index 0)
                store.setField(tableId, keyTuple, 0, abi.encodePacked(uint8(ItemType.Spell)));
                migrated++;
                console.log("  Migrated id", i, spellNames[i - 1], "-> Spell");
            } else if (currentType == uint8(ItemType.Spell)) {
                console.log("  SKIP id", i, spellNames[i - 1], "- already Spell");
            } else {
                console.log("  SKIP id", i, "- unexpected type, not touching");
            }
        }

        vm.stopBroadcast();

        console.log("=== Migration complete:", migrated, "items updated ===");
    }
}
