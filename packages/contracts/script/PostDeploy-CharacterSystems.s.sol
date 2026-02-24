// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@world/IWorld.sol";
import { ResourceId } from "@latticexyz/world/src/WorldResourceId.sol";
import { WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";

// Import our new character systems
import { CharacterCore } from "../src/systems/character/CharacterCore.sol";
import { StatSystem } from "../src/systems/character/StatSystem.sol";
import { WeaponSystem } from "../src/systems/equipment/WeaponSystem.sol";

contract PostDeployCharacterSystems is Script {
    function run() external {
        // Get the world contract
        address worldAddress = vm.envAddress("WORLD_ADDRESS");
        IWorld world = IWorld(worldAddress);
        
        console.log("Deploying Character Systems to world at:", worldAddress);
        
        // Deploy CharacterCore system
        CharacterCore characterCore = new CharacterCore();
        ResourceId characterCoreId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "CharacterCore");
        
        // Deploy StatSystem
        StatSystem statSystem = new StatSystem();
        ResourceId statSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "StatSystem");
        
        // Deploy WeaponSystem
        WeaponSystem weaponSystem = new WeaponSystem();
        ResourceId weaponSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "WeaponSystem");
        
        console.log("Deployed CharacterCore at:", address(characterCore));
        console.log("Deployed StatSystem at:", address(statSystem));
        console.log("Deployed WeaponSystem at:", address(weaponSystem));
        
        // Register systems with the world
        vm.startBroadcast();
        
        try world.registerSystem(characterCoreId, characterCore, true) {
            console.log("CharacterCore registered successfully");
        } catch {
            console.log("CharacterCore already registered or failed");
        }
        
        try world.registerSystem(statSystemId, statSystem, true) {
            console.log("StatSystem registered successfully");
        } catch {
            console.log("StatSystem already registered or failed");
        }
        
        try world.registerSystem(weaponSystemId, weaponSystem, true) {
            console.log("WeaponSystem registered successfully");
        } catch {
            console.log("WeaponSystem already registered or failed");
        }
        
        // Register function selectors for CharacterCore
        try world.registerRootFunctionSelector(
            characterCoreId,
            "mintCharacter(string,uint8,uint8,uint8,uint8,uint8,uint8)",
            "mintCharacter(string,uint8,uint8,uint8,uint8,uint8,uint8)"
        ) {
            console.log("CharacterCore mintCharacter selector registered");
        } catch {
            console.log("CharacterCore mintCharacter selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            characterCoreId,
            "enterGame(bytes32)",
            "enterGame(bytes32)"
        ) {
            console.log("CharacterCore enterGame selector registered");
        } catch {
            console.log("CharacterCore enterGame selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            characterCoreId,
            "updateTokenUri(bytes32,string)",
            "updateTokenUri(bytes32,string)"
        ) {
            console.log("CharacterCore updateTokenUri selector registered");
        } catch {
            console.log("CharacterCore updateTokenUri selector already registered or failed");
        }
        
        // Register function selectors for StatSystem
        try world.registerRootFunctionSelector(
            statSystemId,
            "rollStats(bytes32,uint8)",
            "rollStats(bytes32,uint8)"
        ) {
            console.log("StatSystem rollStats selector registered");
        } catch {
            console.log("StatSystem rollStats selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            statSystemId,
            "updateStats(bytes32,uint8,uint8,uint8,uint8,uint8,uint8)",
            "updateStats(bytes32,uint8,uint8,uint8,uint8,uint8,uint8)"
        ) {
            console.log("StatSystem updateStats selector registered");
        } catch {
            console.log("StatSystem updateStats selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            statSystemId,
            "calculateStatBonuses(bytes32)",
            "calculateStatBonuses(bytes32)"
        ) {
            console.log("StatSystem calculateStatBonuses selector registered");
        } catch {
            console.log("StatSystem calculateStatBonuses selector already registered or failed");
        }
        
        // Register function selectors for WeaponSystem
        try world.registerRootFunctionSelector(
            weaponSystemId,
            "equipWeapon(bytes32,uint256)",
            "equipWeapon(bytes32,uint256)"
        ) {
            console.log("WeaponSystem equipWeapon selector registered");
        } catch {
            console.log("WeaponSystem equipWeapon selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            weaponSystemId,
            "unequipWeapon(bytes32)",
            "unequipWeapon(bytes32)"
        ) {
            console.log("WeaponSystem unequipWeapon selector registered");
        } catch {
            console.log("WeaponSystem unequipWeapon selector already registered or failed");
        }
        
        try world.registerRootFunctionSelector(
            weaponSystemId,
            "getEquippedWeapon(bytes32)",
            "getEquippedWeapon(bytes32)"
        ) {
            console.log("WeaponSystem getEquippedWeapon selector registered");
        } catch {
            console.log("WeaponSystem getEquippedWeapon selector already registered or failed");
        }
        
        vm.stopBroadcast();
        
        console.log("Character Systems deployment completed!");
        console.log("CharacterCore ID:");
        console.logBytes32(ResourceId.unwrap(characterCoreId));
        console.log("StatSystem ID:");
        console.logBytes32(ResourceId.unwrap(statSystemId));
        console.log("WeaponSystem ID:");
        console.logBytes32(ResourceId.unwrap(weaponSystemId));
    }
}
