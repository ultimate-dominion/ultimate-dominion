// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {ResourceAccess} from "@latticexyz/world/src/codegen/tables/ResourceAccess.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {IWorldErrors} from "@latticexyz/world/src/IWorldErrors.sol";
import {Balances as ERC20Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {TotalSupply} from "@latticexyz/world-modules/src/modules/erc20-puppet/tables/TotalSupply.sol";
import {_erc20SystemId, _balancesTableId, _totalSupplyTableId} from "@latticexyz/world-modules/src/modules/erc20-puppet/utils.sol";
import {GOLD_NAMESPACE, WORLD_NAMESPACE} from "../constants.sol";
import {GoldERC20System} from "../src/systems/GoldERC20System.sol";
import {IERC20Mintable} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20Mintable.sol";
import {IERC20} from "@latticexyz/world-modules/src/modules/erc20-puppet/IERC20.sol";

contract Test_GoldERC20System is Test {
    using stdJson for string;

    address deployer;
    IWorld world;
    address worldAddress;
    ResourceId goldErc20SystemId;
    ResourceId goldNs;

    address alice;
    address unauthorized;

    function setUp() public {
        deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        string memory json = vm.readFile(
            string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json"))
        );
        worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        goldErc20SystemId = _erc20SystemId(GOLD_NAMESPACE);
        goldNs = WorldResourceIdLib.encodeNamespace(GOLD_NAMESPACE);

        // Deploy and register GoldERC20System (replaces default ERC20System)
        GoldERC20System goldSystem = new GoldERC20System();
        world.registerSystem(goldErc20SystemId, goldSystem, true);

        // Create test addresses
        alice = makeAddr("alice");
        unauthorized = makeAddr("unauthorized");

        // Grant alice Gold namespace access (simulates what EnsureAccess does for UD systems)
        ResourceAccess.set(goldNs, alice, true);

        vm.stopPrank();
    }

    // ==================== mintWithAccess ====================

    function test_mintWithAccess_succeeds() public {
        uint256 amount = 100 ether;

        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, amount)));

        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        assertEq(ERC20Balances.get(balancesTableId, alice), amount);
    }

    function test_mintWithAccess_updatesTotalSupply() public {
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);
        uint256 supplyBefore = TotalSupply.get(totalSupplyTableId);

        uint256 amount = 50 ether;
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, amount)));

        assertEq(TotalSupply.get(totalSupplyTableId) - supplyBefore, amount);
    }

    function test_mintWithAccess_revertsWithoutAccess() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (unauthorized, 1 ether)));
    }

    function test_mintWithAccess_revertsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (address(0), 1 ether)));
    }

    // ==================== burnWithAccess ====================

    function test_burnWithAccess_succeeds() public {
        uint256 mintAmount = 100 ether;
        uint256 burnAmount = 40 ether;

        // Mint first
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, mintAmount)));

        // Burn
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (alice, burnAmount)));

        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        assertEq(ERC20Balances.get(balancesTableId, alice), mintAmount - burnAmount);
    }

    function test_burnWithAccess_updatesTotalSupply() public {
        ResourceId totalSupplyTableId = _totalSupplyTableId(GOLD_NAMESPACE);
        uint256 mintAmount = 100 ether;
        uint256 burnAmount = 30 ether;

        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, mintAmount)));
        uint256 supplyAfterMint = TotalSupply.get(totalSupplyTableId);

        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (alice, burnAmount)));

        assertEq(supplyAfterMint - TotalSupply.get(totalSupplyTableId), burnAmount);
    }

    function test_burnWithAccess_revertsWithoutAccess() public {
        // Mint some gold to unauthorized address first (as deployer who owns namespace)
        vm.prank(deployer);
        world.call(goldErc20SystemId, abi.encodeCall(IERC20Mintable.mint, (unauthorized, 100 ether)));

        vm.prank(unauthorized);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (unauthorized, 1 ether)));
    }

    function test_burnWithAccess_revertsInsufficientBalance() public {
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, 10 ether)));

        vm.prank(alice);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (alice, 20 ether)));
    }

    function test_burnWithAccess_revertsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.burnWithAccess, (address(0), 1 ether)));
    }

    // ==================== Original mint/burn still work for owner ====================

    function test_originalMint_stillWorksForNamespaceOwner() public {
        // Deployer is namespace owner — original mint should still work
        uint256 amount = 100 ether;
        vm.prank(deployer);
        world.call(goldErc20SystemId, abi.encodeCall(IERC20Mintable.mint, (alice, amount)));

        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        assertEq(ERC20Balances.get(balancesTableId, alice), amount);
    }

    // ==================== Standard ERC20 functions unaffected ====================

    function test_transfer_unaffected() public {
        address bob = makeAddr("bob");
        uint256 amount = 100 ether;

        // Mint to alice
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, amount)));

        // Transfer from alice to bob (standard ERC20 — no access check, just balance check)
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(IERC20.transfer, (bob, 30 ether)));

        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        assertEq(ERC20Balances.get(balancesTableId, alice), 70 ether);
        assertEq(ERC20Balances.get(balancesTableId, bob), 30 ether);
    }

    // ==================== transferWithAccess ====================

    function test_transferWithAccess_succeeds() public {
        address bob = makeAddr("bob");
        uint256 amount = 100 ether;
        uint256 transferAmount = 40 ether;

        // Mint to alice
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, amount)));

        // Transfer via access (simulates system-to-system gold transfer)
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.transferWithAccess, (alice, bob, transferAmount)));

        ResourceId balancesTableId = _balancesTableId(GOLD_NAMESPACE);
        assertEq(ERC20Balances.get(balancesTableId, alice), amount - transferAmount);
        assertEq(ERC20Balances.get(balancesTableId, bob), transferAmount);
    }

    function test_transferWithAccess_revertsWithoutAccess() public {
        // Mint to unauthorized via deployer
        vm.prank(deployer);
        world.call(goldErc20SystemId, abi.encodeCall(IERC20Mintable.mint, (unauthorized, 100 ether)));

        vm.prank(unauthorized);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.transferWithAccess, (unauthorized, alice, 50 ether)));
    }

    function test_transferWithAccess_revertsInsufficientBalance() public {
        vm.prank(alice);
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.mintWithAccess, (alice, 10 ether)));

        vm.prank(alice);
        vm.expectRevert();
        world.call(goldErc20SystemId, abi.encodeCall(GoldERC20System.transferWithAccess, (alice, makeAddr("bob"), 20 ether)));
    }
}
