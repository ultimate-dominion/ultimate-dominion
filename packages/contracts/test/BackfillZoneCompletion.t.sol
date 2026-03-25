// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    StatsData,
    Stats,
    ZoneConfig,
    ZoneCompletions,
    CharacterZoneCompletion,
    Admin
} from "@codegen/index.sol";
import {MAX_LEVEL, ZONE_DARK_CAVE, BADGE_ZONE_CONQUEROR_BASE, MAX_ZONE_CONQUEROR_BADGES} from "../constants.sol";
import {NotAdmin} from "../src/Errors.sol";

contract Test_BackfillZoneCompletion is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Configure Dark Cave zone (not set by PostDeploy)
        ZoneConfig.set(ZONE_DARK_CAVE, MAX_LEVEL, BADGE_ZONE_CONQUEROR_BASE);

        vm.stopPrank();
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(address(uint160(uint256(keccak256(abi.encodePacked(userNonce++))))));
        vm.deal(user, 100 ether);
        return user;
    }

    function _createMaxLevelCharacter(address user) internal returns (bytes32) {
        vm.prank(user);
        bytes32 charId = world.UD__mintCharacter(
            user,
            bytes32(abi.encodePacked("Char", userNonce)),
            "test_uri"
        );

        // Set level to max
        StatsData memory stats = world.UD__getStats(charId);
        stats.level = MAX_LEVEL;
        vm.prank(deployer);
        world.UD__adminSetStats(charId, stats);

        return charId;
    }

    // ==================== Happy Path ====================

    function test_backfill_recordsCompletion() public {
        address alice = _getUser();
        bytes32 charId = _createMaxLevelCharacter(alice);

        // Verify no completion exists yet
        assertFalse(CharacterZoneCompletion.getCompleted(charId, ZONE_DARK_CAVE));

        // Backfill as admin
        vm.prank(deployer);
        world.UD__backfillZoneCompletion(charId);

        // Verify completion recorded
        assertTrue(CharacterZoneCompletion.getCompleted(charId, ZONE_DARK_CAVE));
        assertEq(CharacterZoneCompletion.getRank(charId, ZONE_DARK_CAVE), 1);
        assertGt(CharacterZoneCompletion.getCompletedAt(charId, ZONE_DARK_CAVE), 0);
    }

    function test_backfill_updatesZoneCompletions() public {
        address alice = _getUser();
        bytes32 charId = _createMaxLevelCharacter(alice);

        vm.prank(deployer);
        world.UD__backfillZoneCompletion(charId);

        bytes32[] memory completed = ZoneCompletions.getCompletedCharacters(ZONE_DARK_CAVE);
        assertEq(completed.length, 1);
        assertEq(completed[0], charId);
    }

    function test_backfill_assignsCorrectRanks() public {
        address alice = _getUser();
        address bob = _getUser();
        address carol = _getUser();

        bytes32 charA = _createMaxLevelCharacter(alice);
        bytes32 charB = _createMaxLevelCharacter(bob);
        bytes32 charC = _createMaxLevelCharacter(carol);

        vm.startPrank(deployer);
        world.UD__backfillZoneCompletion(charA);
        world.UD__backfillZoneCompletion(charB);
        world.UD__backfillZoneCompletion(charC);
        vm.stopPrank();

        assertEq(CharacterZoneCompletion.getRank(charA, ZONE_DARK_CAVE), 1);
        assertEq(CharacterZoneCompletion.getRank(charB, ZONE_DARK_CAVE), 2);
        assertEq(CharacterZoneCompletion.getRank(charC, ZONE_DARK_CAVE), 3);

        bytes32[] memory completed = ZoneCompletions.getCompletedCharacters(ZONE_DARK_CAVE);
        assertEq(completed.length, 3);
    }

    // ==================== Idempotency ====================

    function test_backfill_idempotent() public {
        address alice = _getUser();
        bytes32 charId = _createMaxLevelCharacter(alice);

        vm.startPrank(deployer);
        world.UD__backfillZoneCompletion(charId);

        // Calling again should be a no-op (already completed)
        world.UD__backfillZoneCompletion(charId);
        vm.stopPrank();

        // Should still be rank 1, not duplicated
        assertEq(CharacterZoneCompletion.getRank(charId, ZONE_DARK_CAVE), 1);
        bytes32[] memory completed = ZoneCompletions.getCompletedCharacters(ZONE_DARK_CAVE);
        assertEq(completed.length, 1);
    }

    // ==================== Unhappy Paths ====================

    function test_backfill_revertsForNonAdmin() public {
        address alice = _getUser();
        bytes32 charId = _createMaxLevelCharacter(alice);

        vm.prank(alice);
        vm.expectRevert(NotAdmin.selector);
        world.UD__backfillZoneCompletion(charId);
    }

    function test_backfill_noOpBelowMaxLevel() public {
        address alice = _getUser();

        vm.prank(alice);
        bytes32 charId = world.UD__mintCharacter(alice, bytes32("SubMax"), "test_uri");

        // Level 5 — below max
        StatsData memory stats = world.UD__getStats(charId);
        stats.level = 5;
        vm.prank(deployer);
        world.UD__adminSetStats(charId, stats);

        vm.prank(deployer);
        world.UD__backfillZoneCompletion(charId);

        // Should NOT record completion since level < maxLevel
        assertFalse(CharacterZoneCompletion.getCompleted(charId, ZONE_DARK_CAVE));
    }

    function test_backfill_revertsForInvalidCharacter() public {
        bytes32 fakeId = bytes32(uint256(0xdead));

        vm.prank(deployer);
        vm.expectRevert();
        world.UD__backfillZoneCompletion(fakeId);
    }
}
