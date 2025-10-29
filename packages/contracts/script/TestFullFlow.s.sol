// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IWorld } from "@codegen/world/IWorld.sol";
import { ResourceId, WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { Systems } from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {Classes} from "@codegen/common.sol";
import {StatsData, Stats} from "@codegen/index.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

contract TestFullFlow is Script {
    function run() external {
        // Get world address from deployment
        string memory json = vm.readFile(string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json")));
        address worldAddress = abi.decode(vm.parseJson(json, ".worldAddress"), (address));
        
        console.log("=== Testing Full User Flow Against Anvil ===");
        console.log("World Address:", worldAddress);
        
        IWorld world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress); // Required for reading MUD tables
        
        // Use first Anvil account (with pre-funded ETH)
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        address testAccount = vm.addr(deployerPrivateKey);
        console.log("Test Account:", testAccount);
        console.log("Test Account Balance:", testAccount.balance);
        
        // Step 1: Create burner wallet
        address burnerWallet = vm.addr(1000); // Use a deterministic address for burner
        console.log("\nStep 1: Burner wallet created");
        console.log("Burner Wallet:", burnerWallet);
        
        // Step 2: Delegate to burner wallet (must happen before funding)
        console.log("\nStep 2: Setting up delegation...");
        // Use unlimited delegation resource ID
        ResourceId unlimitedDelegationId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "", "unlimited");
        try world.registerDelegation(burnerWallet, unlimitedDelegationId, new bytes(0)) {
            console.log("SUCCESS: Delegation registered!");
        } catch Error(string memory reason) {
            console.log("FAILED: Delegation reverted with reason:");
            console.log(reason);
        } catch (bytes memory lowLevelData) {
            console.log("FAILED: Delegation reverted with low-level error");
            console.logBytes(lowLevelData);
        }
        
        // Step 3: Fund burner wallet (after delegation)
        vm.deal(burnerWallet, 0.1 ether);
        console.log("\nStep 3: Burner wallet funded");
        console.log("Burner Wallet Balance:", burnerWallet.balance);
        
        // Step 4: Mint a character
        console.log("\nStep 4: Minting character...");
        bytes32 characterId;
        // Use a unique deterministic name per run
        bytes32 uniqueName = keccak256(abi.encodePacked("Hero_", block.timestamp, block.number, testAccount));
        try world.UD__mintCharacter(testAccount, uniqueName, "ipfs://bogus-uri") returns (bytes32 id) {
            characterId = id;
            console.log("SUCCESS: Character minted!");
            console.logBytes32(characterId);
        } catch Error(string memory reason) {
            console.log("FAILED: Character mint reverted with reason:");
            console.log(reason);
            vm.stopBroadcast();
            return;
        } catch (bytes memory lowLevelData) {
            console.log("FAILED: Character mint reverted with low-level error");
            console.logBytes(lowLevelData);
            vm.stopBroadcast();
            return;
        }
        
        // Step 5: Roll stats for the character
        console.log("\nStep 5: Rolling stats...");
        vm.deal(testAccount, 1 ether); // Fund account for RNG
        bytes32 randomNumber = bytes32(uint256(block.timestamp));
        
        console.log("Calling UD__rollStats with:");
        console.log("  Randomness:", uint256(randomNumber));
        console.log("  Character ID:", uint256(characterId));
        console.log("  Class: Warrior (0)");
        console.log("  Test Account Balance:", testAccount.balance);
        
        try world.UD__rollStats{value: 0.0001 ether}(randomNumber, characterId, Classes.Warrior) {
            console.log("SUCCESS: Roll stats transaction completed");
        } catch Error(string memory reason) {
            console.log("FAILED: Roll stats reverted with reason:");
            console.log(reason);
        } catch (bytes memory lowLevelData) {
            console.log("FAILED: Roll stats reverted with low-level error");
            console.logBytes(lowLevelData);
        }
        
        // Step 6: Check if stats were actually set
        console.log("\nStep 6: Checking if stats were set...");
        StatsData memory stats = Stats.get(characterId);
        console.log("Stats retrieved from storage");
        console.log("Strength:");
        console.logInt(stats.strength);
        console.log("Agility:");
        console.logInt(stats.agility);
        console.log("Intelligence:");
        console.logInt(stats.intelligence);
        console.log("Max HP:");
        console.logInt(stats.maxHp);
        console.log("Level:");
        console.logUint(stats.level);
        console.log("Class:");
        console.logUint(uint256(stats.class));
        
        // Check if stats are non-zero
        if (stats.strength == 0 && stats.agility == 0 && stats.intelligence == 0) {
            console.log("WARNING: Stats appear to not have been generated!");
        } else {
            console.log("SUCCESS: Stats were generated with values");
        }
        
        // Step 7: Enter the game
        console.log("\nStep 7: Entering the game...");
        // Extra diagnostics before entering game
        try world.UD__getOwner(characterId) returns (address ownerAddr) {
            console.log("Owner (from storage):", ownerAddr);
        } catch {}
        try world.UD__isCharacterLocked(characterId) returns (bool isLocked) {
            console.log("Locked before enter:");
            console.logBool(isLocked);
        } catch {}
        try world.UD__basicCharacterValidation(characterId) returns (bool isValid) {
            console.log("Valid character (basic validation):");
            console.logBool(isValid);
        } catch {}
        try world.UD__enterGame(characterId) {
            console.log("SUCCESS: Character entered the game");
            // Confirm lock state after enter
            try world.UD__isCharacterLocked(characterId) returns (bool isLockedAfter) {
                console.log("Locked after enter:");
                console.logBool(isLockedAfter);
            } catch {}
        } catch Error(string memory reason) {
            console.log("FAILED: Enter game reverted with reason:");
            console.log(reason);
        } catch (bytes memory lowLevelData) {
            console.log("FAILED: Enter game reverted with low-level error");
            console.logBytes(lowLevelData);
        }
        
        vm.stopBroadcast();
        
        console.log("\n=== Character Creation Flow Completed ===");
    }
}

