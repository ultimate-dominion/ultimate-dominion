// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "@world/IWorld.sol";
import {Items, ItemDurability} from "@codegen/index.sol";

/**
 * @title DeployDurabilityData
 * @notice Sets maxDurability for Z2 (Windy Peaks) items based on rarity.
 *         Z1 items keep maxDurability=0 (exempt from durability system).
 *
 * Durability by rarity:
 *   R0 (Common)    = 20
 *   R1 (Uncommon)  = 30
 *   R2 (Rare)      = 40
 *   R3 (Epic)      = 50
 *   R4 (Legendary) = 60
 *
 * Prerequisites:
 * - World must be deployed with ItemDurability table
 * - Z2 items must already be loaded (item IDs known)
 *
 * Usage:
 *   forge script DeployDurabilityData --broadcast \
 *     --sig "run(address,uint256,uint256)" <WORLD_ADDRESS> <START_ITEM_ID> <END_ITEM_ID>
 */
contract DeployDurabilityData is Script {
    IWorld public world;

    // Rarity -> maxDurability mapping
    uint256 constant DURABILITY_R0 = 20;
    uint256 constant DURABILITY_R1 = 30;
    uint256 constant DURABILITY_R2 = 40;
    uint256 constant DURABILITY_R3 = 50;
    uint256 constant DURABILITY_R4 = 60;

    function run(address _worldAddress, uint256 startItemId, uint256 endItemId) external {
        require(startItemId <= endItemId, "startItemId must be <= endItemId");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        console.log("=== DeployDurabilityData ===");
        console.log("Setting durability for item range:", startItemId, "-", endItemId);

        uint256 count = 0;
        uint256 skipped = 0;

        for (uint256 itemId = startItemId; itemId <= endItemId; itemId++) {
            uint256 rarity = Items.getRarity(itemId);
            uint256 durability = _durabilityForRarity(rarity);

            if (durability == 0) {
                // Unknown rarity, skip
                console.log("  SKIP itemId (unknown rarity):", itemId);
                skipped++;
                continue;
            }

            ItemDurability.set(itemId, durability, durability);
            count++;

            // Log every 10th item to avoid console spam on large ranges
            if (count % 10 == 0) {
                console.log("  Progress:", count, "items set");
            }
        }

        console.log("Durability set for", count, "items");
        if (skipped > 0) {
            console.log("Skipped", skipped, "items (unknown rarity)");
        }

        vm.stopBroadcast();

        console.log("=== DeployDurabilityData Complete ===");
    }

    function _durabilityForRarity(uint256 rarity) internal pure returns (uint256) {
        if (rarity == 0) return DURABILITY_R0;
        if (rarity == 1) return DURABILITY_R1;
        if (rarity == 2) return DURABILITY_R2;
        if (rarity == 3) return DURABILITY_R3;
        if (rarity == 4) return DURABILITY_R4;
        return 0; // Unknown rarity
    }
}
