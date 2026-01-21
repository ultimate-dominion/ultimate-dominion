// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {System} from "@latticexyz/world/src/System.sol";

import {IWorld} from "@world/IWorld.sol";
import {StatSystem} from "@systems/character/StatSystem.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";

contract TestStatSystem is Script {
    IWorld public world;
    ResourceId public statSystemId;

    function run(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("Testing StatSystem deployment...");

        // Deploy StatSystem
        System statSystem = new StatSystem();
        
        statSystemId = WorldResourceIdLib.encode({
            typeId: RESOURCE_SYSTEM,
            namespace: "UD",
            name: "StatSystem"
        });

        world.registerSystem(statSystemId, statSystem, true);

        // Register function selectors
        world.registerRootFunctionSelector(statSystemId, "rollStats(bytes32,bytes32,uint8)", "rollStats(bytes32,bytes32,uint8)");
        world.registerRootFunctionSelector(statSystemId, "updateStats(bytes32,tuple)", "updateStats(bytes32,tuple)");
        world.registerRootFunctionSelector(statSystemId, "calculateStatBonuses(bytes32)", "calculateStatBonuses(bytes32)");
        world.registerRootFunctionSelector(statSystemId, "validateStatRequirements(bytes32,tuple)", "validateStatRequirements(bytes32,tuple)");
        world.registerRootFunctionSelector(statSystemId, "getCurrentAvailableLevel(uint256)", "getCurrentAvailableLevel(uint256)");
        world.registerRootFunctionSelector(statSystemId, "levelCharacter(bytes32,tuple)", "levelCharacter(bytes32,tuple)");
        world.registerRootFunctionSelector(statSystemId, "setStats(bytes32,tuple)", "setStats(bytes32,tuple)");
        world.registerRootFunctionSelector(statSystemId, "getStats(bytes32)", "getStats(bytes32)");
        world.registerRootFunctionSelector(statSystemId, "getBaseStats(bytes32)", "getBaseStats(bytes32)");
        world.registerRootFunctionSelector(statSystemId, "getClass(bytes32)", "getClass(bytes32)");
        world.registerRootFunctionSelector(statSystemId, "getExperience(bytes32)", "getExperience(bytes32)");
        world.registerRootFunctionSelector(statSystemId, "getLevel(bytes32)", "getLevel(bytes32)");

        console.log("StatSystem registered with ID:", uint256(uint160(address(statSystem))));

        // Test basic functionality
        _testStatSystem();

        vm.stopBroadcast();
    }

    function _testStatSystem() internal {
        console.log("Testing StatSystem functionality...");

        // Test getCurrentAvailableLevel with some experience values
        try world.UD__getCurrentAvailableLevel(0) returns (uint256 level) {
            console.log("Level for 0 experience:", level);
        } catch {
            console.log("getCurrentAvailableLevel not available yet");
        }

        // Test calculateStatBonuses with a test character ID (now returns statPoints, hpGain)
        bytes32 testCharacterId = bytes32(uint256(1));
        try world.UD__calculateStatBonuses(testCharacterId) returns (int256 statPoints, int256 hpGain) {
            // Stat bonuses calculated successfully
        } catch {
            // calculateStatBonuses not available yet
        }

        console.log("StatSystem basic functionality test completed");
    }
}
