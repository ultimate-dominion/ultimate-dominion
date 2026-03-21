// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {GasReserve} from "@codegen/index.sol";

/**
 * @title GasReserve Table Tests
 * @notice Verifies the new GasReserve table reads/writes correctly.
 *         GoldLib integration tests are in GasStation.t.sol (commit 2).
 */
contract GasReserveTest is Test {
    using stdJson for string;

    address deployer;
    IWorld world;

    function setUp() public {
        deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        vm.startPrank(deployer);

        string memory json = vm.readFile(string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json")));
        address worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        vm.stopPrank();
    }

    function test_gasReserve_initiallyZero() public {
        bytes32 characterId = bytes32("nonexistent");
        assertEq(GasReserve.getBalance(characterId), 0);
    }

    function test_gasReserve_setAndGet() public {
        bytes32 characterId = bytes32("testChar1");

        GasReserve.setBalance(characterId, 100 ether);
        assertEq(GasReserve.getBalance(characterId), 100 ether);

        // Update
        GasReserve.setBalance(characterId, 50 ether);
        assertEq(GasReserve.getBalance(characterId), 50 ether);

        // Zero out
        GasReserve.setBalance(characterId, 0);
        assertEq(GasReserve.getBalance(characterId), 0);
    }

    function test_gasReserve_multipleCharacters() public {
        bytes32 char1 = bytes32("char1");
        bytes32 char2 = bytes32("char2");

        GasReserve.setBalance(char1, 100 ether);
        GasReserve.setBalance(char2, 200 ether);

        assertEq(GasReserve.getBalance(char1), 100 ether);
        assertEq(GasReserve.getBalance(char2), 200 ether);

        // Independent — modifying one doesn't affect the other
        GasReserve.setBalance(char1, 0);
        assertEq(GasReserve.getBalance(char1), 0);
        assertEq(GasReserve.getBalance(char2), 200 ether);
    }

    function test_gasReserve_largeValue() public {
        bytes32 characterId = bytes32("whale");
        uint256 largeAmount = 1_000_000 ether;

        GasReserve.setBalance(characterId, largeAmount);
        assertEq(GasReserve.getBalance(characterId), largeAmount);
    }
}
