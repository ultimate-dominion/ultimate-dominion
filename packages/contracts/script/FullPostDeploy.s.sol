// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@world/IWorld.sol";

import {MinimalPostDeploy} from "./MinimalPostDeploy.s.sol";
import {TestCharacterCore} from "./TestCharacterCore.s.sol";
import {TestStatSystem} from "./TestStatSystem.s.sol";

contract FullPostDeploy is Script {
    IWorld public world;

    function run(address _worldAddress) external {
        world = IWorld(_worldAddress);
        StoreSwitch.setStoreAddress(_worldAddress);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Starting Full PostDeploy ===");

        // Tier 1: Core systems
        console.log("Tier 1: Deploying core systems...");
        MinimalPostDeploy minimalDeploy = new MinimalPostDeploy();
        minimalDeploy.run(_worldAddress);

        // Tier 2: Modular systems
        console.log("Tier 2: Deploying modular systems...");
        _deployCharacterSystems(_worldAddress);
        _deployEquipmentSystems(_worldAddress);
        _deployCombatSystems(_worldAddress);

        // Tier 3: Complete game state
        console.log("Tier 3: Setting up complete game state...");
        _setupCompleteGameState();

        console.log("=== Full PostDeploy Complete ===");
        vm.stopBroadcast();
    }

    function _deployCharacterSystems(address _worldAddress) internal {
        console.log("Deploying CharacterCore and StatSystem...");
        
        TestCharacterCore characterDeploy = new TestCharacterCore();
        characterDeploy.run(_worldAddress);
        
        TestStatSystem statDeploy = new TestStatSystem();
        statDeploy.run(_worldAddress);
    }

    function _deployEquipmentSystems(address _worldAddress) internal {
        console.log("Deploying equipment systems...");
        // TODO: Add WeaponSystem, ArmorSystem, etc.
    }

    function _deployCombatSystems(address _worldAddress) internal {
        console.log("Deploying combat systems...");
        // TODO: Add CombatSystem, EffectsSystem, etc.
    }

    function _setupCompleteGameState() internal {
        console.log("Setting up complete game state...");
        // TODO: Add items, monsters, shops, etc.
    }
}
