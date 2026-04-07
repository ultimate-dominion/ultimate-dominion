// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    Admin,
    PositionV2,
    NpcDialogue,
    NpcDialogueData,
    FragmentChainProgress,
    FragmentChainStep,
    Characters
} from "@codegen/index.sol";
import {FragmentType, FragmentTriggerType} from "@codegen/common.sol";
import {NotAtNpcPosition, NpcHasNoDialogue, NotAdmin} from "../src/Errors.sol";

contract Test_NpcDialogueSystem is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    bytes32 constant NPC_ID = bytes32("testNpc1");
    uint16 constant TEST_X = 5;
    uint16 constant TEST_Y = 5;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Place the NPC at zone 1, (5, 5)
        PositionV2.set(NPC_ID, 1, TEST_X, TEST_Y);

        vm.stopPrank();
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    function _createCharacter(address user) internal returns (bytes32) {
        vm.prank(user);
        bytes32 charId = world.UD__mintCharacter(
            user,
            bytes32(abi.encodePacked("Char", userNonce)),
            "test_uri"
        );
        return charId;
    }

    function _placeCharacterAt(bytes32 charId, uint16 x, uint16 y) internal {
        vm.startPrank(deployer);
        PositionV2.set(charId, 1, x, y);
        vm.stopPrank();
    }

    function _setDialogue(bytes32 npcId, uint8 fragmentType, string memory lines) internal {
        vm.prank(deployer);
        world.UD__setNpcDialogue(npcId, fragmentType, 0, 1, lines);
    }

    // ==================== Tests ====================

    /// @notice Talk to NPC at same position succeeds and emits NpcInteraction event
    function test_talkToNpc_emitsEvent() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        _placeCharacterAt(charId, TEST_X, TEST_Y);

        // Set dialogue with no fragment link (fragmentType=0)
        _setDialogue(NPC_ID, 0, "Hello traveler|Welcome to the village");

        // Expect the NpcInteraction event from the world address
        vm.expectEmit(true, true, false, true, worldAddress);
        emit NpcInteraction(charId, NPC_ID, 0);

        vm.prank(alice);
        world.UD__talkToNpc(charId, NPC_ID);
    }

    /// @notice Talking to NPC linked to a fragment chain advances the chain step
    function test_talkToNpc_advancesFragmentChain() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        _placeCharacterAt(charId, TEST_X, TEST_Y);

        uint8 fragType = 9; // Zone 2 fragment type

        // Set dialogue linked to fragment chain
        _setDialogue(NPC_ID, fragType, "The ancient power stirs|Seek the crystal");

        // Configure a 3-step chain: step 0 = NpcInteract with NPC_ID
        vm.startPrank(deployer);
        world.UD__setChainStep(
            fragType,
            0, // stepIndex
            uint8(FragmentTriggerType.NpcInteract),
            abi.encode(NPC_ID),
            "Spoke to the village elder"
        );
        // Initialize character chain progress
        world.UD__initializeCharacterChain(charId, fragType, 3);
        vm.stopPrank();

        // Verify starting state
        assertEq(FragmentChainProgress.getCurrentStep(charId, FragmentType(fragType)), 0, "Should start at step 0");

        // Talk to NPC — should advance chain
        vm.prank(alice);
        world.UD__talkToNpc(charId, NPC_ID);

        // Chain should have advanced to step 1
        assertEq(FragmentChainProgress.getCurrentStep(charId, FragmentType(fragType)), 1, "Should advance to step 1");
    }

    /// @notice Reverts when character is at a different position than the NPC
    function test_talkToNpc_revertsWrongPosition() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        _placeCharacterAt(charId, 10, 10); // Different from NPC at (5,5)

        _setDialogue(NPC_ID, 0, "You should not see this");

        vm.prank(alice);
        vm.expectRevert(NotAtNpcPosition.selector);
        world.UD__talkToNpc(charId, NPC_ID);
    }

    /// @notice Reverts when NPC has no dialogue configured
    function test_talkToNpc_revertsNoDialogue() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        _placeCharacterAt(charId, TEST_X, TEST_Y);

        // NPC_ID has no dialogue set — dialogueLines is empty string by default

        vm.prank(alice);
        vm.expectRevert(NpcHasNoDialogue.selector);
        world.UD__talkToNpc(charId, NPC_ID);
    }

    /// @notice Non-admin cannot call setNpcDialogue
    function test_setNpcDialogue_revertsNonAdmin() public {
        address alice = _getUser();

        vm.prank(alice);
        vm.expectRevert(NotAdmin.selector);
        world.UD__setNpcDialogue(NPC_ID, 0, 0, 1, "should fail");
    }

    // ==================== Event declaration for expectEmit ====================

    event NpcInteraction(bytes32 indexed characterId, bytes32 indexed npcId, uint8 fragmentType);
}
