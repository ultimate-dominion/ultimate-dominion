// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Stats, StatsData} from "@codegen/index.sol";
import {Classes} from "@codegen/common.sol";

contract StatsRollIntegrationTest is Test {
    IWorld world;
    address worldAddress;
    address account;

    function setUp() public {
        worldAddress = vm.envAddress("WORLD_ADDRESS");
        world = IWorld(worldAddress);
        StoreSwitch.setStoreAddress(worldAddress);

        // Use the first default anvil account
        account = vm.addr(uint256(1));
        vm.deal(account, 1 ether);
    }

    function testMintRollStatsAndVerify() public {
        vm.startPrank(account);

        // Mint character with unique name
        bytes32 name = keccak256(abi.encodePacked("TestHero_", block.timestamp, account));
        bytes32 characterId = world.UD__mintCharacter(account, name, "ipfs://test-uri");

        // Roll stats with simple user randomness
        bytes32 userRandom = keccak256(abi.encodePacked("rand_", block.number, account));
        world.UD__rollStats{value: 0.0001 ether}(userRandom, characterId, Classes.Warrior);

        // Read stats from storage and assert they were set
        StatsData memory s = Stats.get(characterId);
        console.log("Rolled STR:");
        console.logInt(s.strength);
        console.log("Rolled AGI:");
        console.logInt(s.agility);
        console.log("Rolled INT:");
        console.logInt(s.intelligence);
        assertTrue(s.maxHp > 0, "maxHp should be > 0 after rolling");
        assertTrue(s.strength != 0 || s.agility != 0 || s.intelligence != 0, "stats should not be all zero");

        vm.stopPrank();
    }
}


