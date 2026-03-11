// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {WeaponStats, WeaponStatsData, ArmorStats, ArmorStatsData, Items} from "@codegen/index.sol";
import {ItemType} from "@codegen/common.sol";

contract ReadWeaponStats is Script {
    function run(address _worldAddress) external {
        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 totalItems = 40; // Dark Cave has ~40 items
        console.log("=== Reading Item Stats ===");
        console.log("World:", _worldAddress);

        for (uint256 i = 1; i <= totalItems; i++) {
            ItemType itemType = Items.getItemType(i);

            if (itemType == ItemType.Weapon) {
                WeaponStatsData memory ws = WeaponStats.get(i);
                console.log("--- Weapon ID:", i);
                console.log("  minDamage:", uint256(ws.minDamage));
                console.log("  maxDamage:", uint256(ws.maxDamage));
                console.log("  strMod:", uint256(ws.strModifier));
                console.log("  agiMod:", uint256(ws.agiModifier));
                console.log("  intMod:", uint256(ws.intModifier));
                console.log("  hpMod:", uint256(ws.hpModifier));
            } else if (itemType == ItemType.Armor) {
                ArmorStatsData memory as_ = ArmorStats.get(i);
                console.log("--- Armor ID:", i);
                console.log("  armorMod:", uint256(as_.armorModifier));
                console.log("  strMod:", uint256(as_.strModifier));
                console.log("  agiMod:", uint256(as_.agiModifier));
                console.log("  intMod:", uint256(as_.intModifier));
                console.log("  hpMod:", uint256(as_.hpModifier));
            }
        }
    }
}
