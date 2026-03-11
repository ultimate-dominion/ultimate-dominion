// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {WeaponStats, Items} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

contract QuickCheck is Script {
    function run(address _worldAddress) external {
        StoreSwitch.setStoreAddress(_worldAddress);

        // Find all weapons and print their ID + damage
        for (uint256 i = 1; i <= 60; i++) {
            ItemType t = Items.getItemType(i);
            if (t == ItemType.Weapon) {
                int256 minD = WeaponStats.getMinDamage(i);
                int256 maxD = WeaponStats.getMaxDamage(i);
                console.log("W %d: %d-%d", i, uint256(minD), uint256(maxD));
            }
        }
    }
}
