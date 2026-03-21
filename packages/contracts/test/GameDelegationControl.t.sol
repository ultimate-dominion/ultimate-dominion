// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {AllowedGameSystems, Spawned} from "@codegen/index.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_SYSTEM} from "@latticexyz/world/src/worldResourceTypes.sol";
import {UNLIMITED_DELEGATION} from "@latticexyz/world/src/constants.sol";
import {GAME_DELEGATION_NAME, WORLD_NAMESPACE} from "../constants.sol";

contract Test_GameDelegationControl is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    address payable public alice;
    address payable public burner;
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    bytes32 public aliceCharacterId;

    // ResourceId for GameDelegationControl system
    ResourceId public gameDelegationId;

    // ResourceIds for test systems
    ResourceId public mapSystemId;
    ResourceId public adminSystemId;
    ResourceId public lootManagerSystemId;

    function setUp() public {
        vm.startPrank(deployer);
        string memory json = vm.readFile(
            string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json"))
        );
        worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Create users
        alice = _getUser();
        burner = _getUser();
        vm.label(alice, "alice");
        vm.label(burner, "burner");

        // Build ResourceIds
        gameDelegationId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", GAME_DELEGATION_NAME);
        mapSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MapSystem");
        adminSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "AdminSystem");
        lootManagerSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "LootManagerSyste");

        vm.stopPrank();

        // Mint character as alice
        vm.prank(alice);
        aliceCharacterId = world.UD__mintCharacter(alice, bytes32("AliceDel"), "test_uri_del");

        // Register game delegation from alice to burner
        vm.prank(alice);
        world.registerDelegation(
            burner,
            gameDelegationId,
            abi.encodeWithSignature("initDelegation(address)", burner)
        );
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    // ==================== Tests ====================

    /**
     * @notice Test that a whitelisted system call succeeds via delegation.
     * MapSystem.spawn() is whitelisted — burner should be able to call it via callFrom.
     */
    function test_allowedSystemCall_spawn() public {
        // Burner calls spawn on behalf of alice via callFrom
        vm.prank(burner);
        world.callFrom(
            alice,
            mapSystemId,
            abi.encodeWithSignature("spawn(bytes32)", aliceCharacterId)
        );

        // Verify character is spawned
        assertTrue(Spawned.getSpawned(aliceCharacterId), "Character should be spawned");
    }

    /**
     * @notice Test that a non-whitelisted system call is blocked.
     * AdminSystem is NOT in the whitelist — should revert.
     */
    function test_blockedSystemCall_admin() public {
        // AdminSystem is not whitelisted
        assertFalse(AllowedGameSystems.getAllowed(adminSystemId), "AdminSystem should not be whitelisted");

        // Burner tries to call admin function via callFrom — should revert
        vm.prank(burner);
        vm.expectRevert();
        world.callFrom(
            alice,
            adminSystemId,
            abi.encodeWithSignature("adminPause()")
        );
    }

    /**
     * @notice Test that transferGold is blocked through delegation.
     * transferGold can send gold to arbitrary addresses — must be blocked.
     */
    function test_lootManagerTransferGoldBlocked() public {
        // Burner tries to call transferGold on behalf of alice — should revert
        vm.prank(burner);
        vm.expectRevert();
        world.callFrom(
            alice,
            lootManagerSystemId,
            abi.encodeWithSignature("transferGold(address,uint256)", burner, 1000 ether)
        );
    }

    /**
     * @notice Test that setGoldApproval is blocked through delegation.
     */
    function test_lootManagerSetGoldApprovalBlocked() public {
        vm.prank(burner);
        vm.expectRevert();
        world.callFrom(
            alice,
            lootManagerSystemId,
            abi.encodeWithSignature("setGoldApproval(address,uint256)", burner, type(uint256).max)
        );
    }

    /**
     * @notice Test that setItemsApproval is blocked through delegation.
     */
    function test_lootManagerSetItemsApprovalBlocked() public {
        vm.prank(burner);
        vm.expectRevert();
        world.callFrom(
            alice,
            lootManagerSystemId,
            abi.encodeWithSignature("setItemsApproval(address,bool)", burner, true)
        );
    }

    /**
     * @notice Test that admin can modify the whitelist.
     */
    function test_adminCanModifyWhitelist() public {
        ResourceId testSystemId = WorldResourceIdLib.encode(RESOURCE_SYSTEM, "UD", "MobSystem");

        // MobSystem is not whitelisted by default
        assertFalse(AllowedGameSystems.getAllowed(testSystemId), "MobSystem should not be whitelisted initially");

        // Admin adds it
        vm.prank(deployer);
        AllowedGameSystems.setAllowed(testSystemId, true);
        assertTrue(AllowedGameSystems.getAllowed(testSystemId), "MobSystem should be whitelisted after admin adds it");

        // Admin removes it
        vm.prank(deployer);
        AllowedGameSystems.setAllowed(testSystemId, false);
        assertFalse(AllowedGameSystems.getAllowed(testSystemId), "MobSystem should not be whitelisted after removal");
    }

    /**
     * @notice Test that existing unlimited delegations still work (backwards compat).
     */
    function test_unlimitedDelegationStillWorks() public {
        address payable bob = _getUser();
        address payable bobBurner = _getUser();

        // Mint bob a character
        vm.prank(bob);
        bytes32 bobCharacterId = world.UD__mintCharacter(bob, bytes32("BobDel"), "test_uri_bob_del");

        // Register UNLIMITED delegation (old style)
        vm.prank(bob);
        world.registerDelegation(bobBurner, UNLIMITED_DELEGATION, "");

        // Bob's burner should still be able to call whitelisted systems
        vm.prank(bobBurner);
        world.callFrom(
            bob,
            mapSystemId,
            abi.encodeWithSignature("spawn(bytes32)", bobCharacterId)
        );

        assertTrue(Spawned.getSpawned(bobCharacterId), "Bob's character should be spawned via unlimited delegation");
    }

    /**
     * @notice Test that an unregistered delegatee cannot call systems.
     */
    function test_noDelegationReverts() public {
        address payable stranger = _getUser();

        // Stranger has no delegation from alice
        vm.prank(stranger);
        vm.expectRevert();
        world.callFrom(
            alice,
            mapSystemId,
            abi.encodeWithSignature("spawn(bytes32)", aliceCharacterId)
        );
    }
}
