// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { AccessoryStatsData } from "@codegen/index.sol";

contract TestAccessorySystem is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);

        console.log("Testing AccessorySystem with world at:", worldAddress);

        // Test getting accessory stats for a non-existent accessory
        try world.UD__UD__getAccessoryStats(1) returns (AccessoryStatsData memory accessoryStats) {
            console.log("AccessoryStats for item 1:");
            console.log("  agiModifier:", uint256(accessoryStats.agiModifier));
            console.log("  armorModifier:", uint256(accessoryStats.armorModifier));
            console.log("  hpModifier:", uint256(accessoryStats.hpModifier));
            console.log("  intModifier:", uint256(accessoryStats.intModifier));
            console.log("  minLevel:", accessoryStats.minLevel);
            console.log("  strModifier:", uint256(accessoryStats.strModifier));
            console.log("  effects length:", accessoryStats.effects.length);
        } catch Error(string memory reason) {
            console.log("Expected error for non-existent accessory:", reason);
        }

        // Test getting equipped accessories for a non-existent character
        try world.UD__UD__getEquippedAccessories(bytes32(uint256(1))) returns (uint256[] memory equippedAccessories) {
            console.log("Equipped accessories for character 1:", equippedAccessories.length);
        } catch Error(string memory reason) {
            console.log("Expected error for non-existent character:", reason);
        }

        // Test checking if accessory is equipped
        try world.UD__UD__isAccessoryEquipped(bytes32(uint256(1)), 1) returns (bool isEquipped) {
            console.log("Is accessory 1 equipped on character 1:", isEquipped);
        } catch Error(string memory reason) {
            console.log("Expected error:", reason);
        }

        console.log("AccessorySystem basic functionality test completed!");

        vm.stopBroadcast();
    }
}
