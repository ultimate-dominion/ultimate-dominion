// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Items} from "@codegen/index.sol";

/**
 * @title SetDropRates
 * @notice Bulk-sets item drop rates for testing.
 *         Usage: PRIVATE_KEY=0x... forge script script/SetDropRates.s.sol --sig "run(address,uint256)" <worldAddress> <dropChance> --broadcast --rpc-url $RPC_URL
 */
contract SetDropRates is Script {
    function run(address _worldAddress, uint256 _dropChance) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 totalItems = IWorld(_worldAddress).UD__getCurrentItemsCounter();
        console.log("=== Set Drop Rates ===");
        console.log("World:", _worldAddress);
        console.log("Total items:", totalItems);
        console.log("Target drop chance:", _dropChance);

        uint256 updated;
        for (uint256 i = 1; i <= totalItems; i++) {
            uint256 current = Items.getDropChance(i);
            // Skip items with 0 drop chance (monster abilities, non-droppable)
            if (current == 0) {
                console.log("  Skipping item", i, "(non-droppable)");
                continue;
            }
            Items.setDropChance(i, _dropChance);
            updated++;
        }

        vm.stopBroadcast();

        console.log("Updated %d items to %d%% drop chance", updated, _dropChance);
        console.log("=== Done ===");
    }
}
