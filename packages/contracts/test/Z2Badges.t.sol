// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {
    StatsData,
    Stats,
    Characters,
    ZoneConfig,
    ZoneMapConfig,
    ZoneCompletions,
    CharacterZoneCompletion,
    CharacterZone,
    Spawned,
    Admin
} from "@codegen/index.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {
    MAX_LEVEL,
    ZONE_DARK_CAVE,
    ZONE_WINDY_PEAKS,
    ZONE_ORIGIN_SPACING,
    BADGE_ZONE_CONQUEROR_BASE,
    BADGE_ZONE_PIONEER_BASE,
    BADGE_ZONE_FRAGMENT_BASE,
    BADGES_NAMESPACE,
    MAX_ZONE_CONQUEROR_BADGES
} from "../constants.sol";
import {
    AlreadyInZone,
    ZoneLevelTooLow,
    PrerequisiteZoneIncomplete
} from "../src/Errors.sol";

contract Test_Z2Badges is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    uint256 public userNonce = 0;

    IWorld public world;
    address public worldAddress;

    ResourceId badgesOwnersTable;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        string memory json = vm.readFile(
            string(abi.encodePacked(vm.projectRoot(), "/deploys/31337/latest.json"))
        );
        worldAddress = json.readAddress(".worldAddress");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        badgesOwnersTable = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");

        // Configure zones
        ZoneConfig.set(ZONE_DARK_CAVE, MAX_LEVEL, BADGE_ZONE_CONQUEROR_BASE);
        ZoneConfig.set(ZONE_WINDY_PEAKS, MAX_LEVEL, BADGE_ZONE_CONQUEROR_BASE + 1);

        // Configure zone maps
        ZoneMapConfig.set(ZONE_DARK_CAVE, 10, 10, 0, 0, 1);
        ZoneMapConfig.set(ZONE_WINDY_PEAKS, 10, 10, 0, ZONE_ORIGIN_SPACING, 11);

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

    function _setLevel(bytes32 charId, uint256 level) internal {
        StatsData memory stats = world.UD__getStats(charId);
        stats.level = level;
        vm.prank(deployer);
        world.UD__adminSetStats(charId, stats);
    }

    function _spawnCharacter(bytes32 charId) internal {
        Spawned.setSpawned(charId, true);
    }

    function _completeDarkCave(bytes32 charId) internal {
        CharacterZoneCompletion.set(charId, ZONE_DARK_CAVE, true, block.timestamp, 1);
    }

    function _badgeExists(uint256 badgeBase, uint256 tokenId) internal view returns (bool) {
        uint256 badgeId = badgeBase * 1_000_000 + tokenId;
        return ERC721Owners.get(badgesOwnersTable, badgeId) != address(0);
    }

    function _getTokenId(bytes32 charId) internal view returns (uint256) {
        return Characters.getTokenId(charId);
    }

    // ==================== Zone Conqueror WP — Happy Path ====================

    function test_zoneConquerorWP_mintedOnMaxLevel() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        uint256 tokenId = _getTokenId(charId);

        // Set level to max and trigger backfill (simulates reaching max level)
        _setLevel(charId, MAX_LEVEL);

        // Configure zone 2 completion manually (since we can't run full level-up flow)
        vm.prank(deployer);
        world.UD__backfillZoneCompletion(charId);

        // Should have Zone Conqueror for both zones
        assertTrue(CharacterZoneCompletion.getCompleted(charId, ZONE_DARK_CAVE));
        assertTrue(CharacterZoneCompletion.getCompleted(charId, ZONE_WINDY_PEAKS));
    }

    function test_zoneConquerorWP_rankTracking() public {
        address alice = _getUser();
        address bob = _getUser();

        bytes32 charA = _createCharacter(alice);
        bytes32 charB = _createCharacter(bob);

        _setLevel(charA, MAX_LEVEL);
        _setLevel(charB, MAX_LEVEL);

        vm.startPrank(deployer);
        world.UD__backfillZoneCompletion(charA);
        world.UD__backfillZoneCompletion(charB);
        vm.stopPrank();

        assertEq(CharacterZoneCompletion.getRank(charA, ZONE_WINDY_PEAKS), 1);
        assertEq(CharacterZoneCompletion.getRank(charB, ZONE_WINDY_PEAKS), 2);
    }

    // ==================== Peaks Pioneer — Happy Path ====================

    function test_pioneer_mintedOnZoneTransition() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        uint256 tokenId = _getTokenId(charId);

        // Prepare: level 11, spawned, Dark Cave completed
        _setLevel(charId, 11);
        vm.startPrank(deployer);
        _spawnCharacter(charId);
        _completeDarkCave(charId);
        vm.stopPrank();

        // Pioneer badge should NOT exist yet
        assertFalse(_badgeExists(BADGE_ZONE_PIONEER_BASE + ZONE_WINDY_PEAKS, tokenId));

        // Transition to Windy Peaks
        vm.prank(alice);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);

        // Pioneer badge should now exist
        assertTrue(_badgeExists(BADGE_ZONE_PIONEER_BASE + ZONE_WINDY_PEAKS, tokenId));
    }

    function test_pioneer_notRemintedOnReentry() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);
        uint256 tokenId = _getTokenId(charId);

        _setLevel(charId, 11);
        vm.startPrank(deployer);
        _spawnCharacter(charId);
        _completeDarkCave(charId);
        vm.stopPrank();

        // First transition
        vm.prank(alice);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);
        assertTrue(_badgeExists(BADGE_ZONE_PIONEER_BASE + ZONE_WINDY_PEAKS, tokenId));

        // Go back to Dark Cave
        vm.prank(alice);
        world.UD__transitionZone(charId, ZONE_DARK_CAVE);

        // Re-enter Windy Peaks — should NOT revert (badge already exists, just skips)
        vm.prank(alice);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);

        // Badge still exists, no double-mint
        assertTrue(_badgeExists(BADGE_ZONE_PIONEER_BASE + ZONE_WINDY_PEAKS, tokenId));
    }

    // ==================== Unhappy Paths ====================

    function test_transition_revertsIfLevelTooLow() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setLevel(charId, 5); // Need 11 for WP
        vm.startPrank(deployer);
        _spawnCharacter(charId);
        _completeDarkCave(charId);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(ZoneLevelTooLow.selector);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);
    }

    function test_transition_revertsIfPrereqIncomplete() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setLevel(charId, 11);
        vm.startPrank(deployer);
        _spawnCharacter(charId);
        vm.stopPrank();
        // Deliberately NOT completing Dark Cave

        vm.prank(alice);
        vm.expectRevert(PrerequisiteZoneIncomplete.selector);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);
    }

    function test_transition_revertsIfAlreadyInZone() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setLevel(charId, 11);
        vm.startPrank(deployer);
        _spawnCharacter(charId);
        _completeDarkCave(charId);
        vm.stopPrank();

        vm.prank(alice);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);

        vm.prank(alice);
        vm.expectRevert(AlreadyInZone.selector);
        world.UD__transitionZone(charId, ZONE_WINDY_PEAKS);
    }

    // ==================== Edge Cases ====================

    function test_zoneConqueror_belowMaxLevelNoCompletion() public {
        address alice = _getUser();
        bytes32 charId = _createCharacter(alice);

        _setLevel(charId, MAX_LEVEL - 1);
        vm.prank(deployer);
        world.UD__backfillZoneCompletion(charId);

        assertFalse(CharacterZoneCompletion.getCompleted(charId, ZONE_WINDY_PEAKS));
    }

    function test_zoneConqueror_beyondTopN_noBadge() public {
        // Create MAX_ZONE_CONQUEROR_BADGES + 1 characters at max level
        bytes32[] memory charIds = new bytes32[](MAX_ZONE_CONQUEROR_BADGES + 1);

        for (uint256 i = 0; i <= MAX_ZONE_CONQUEROR_BADGES; i++) {
            address user = _getUser();
            charIds[i] = _createCharacter(user);
            _setLevel(charIds[i], MAX_LEVEL);

            vm.prank(deployer);
            world.UD__backfillZoneCompletion(charIds[i]);
        }

        // Character at rank MAX_ZONE_CONQUEROR_BADGES should have badge
        uint256 tokenIdInTop = _getTokenId(charIds[MAX_ZONE_CONQUEROR_BADGES - 1]);
        assertTrue(_badgeExists(BADGE_ZONE_CONQUEROR_BASE + 1, tokenIdInTop));

        // Character at rank MAX_ZONE_CONQUEROR_BADGES + 1 should NOT have badge
        uint256 tokenIdOutOfTop = _getTokenId(charIds[MAX_ZONE_CONQUEROR_BADGES]);
        assertFalse(_badgeExists(BADGE_ZONE_CONQUEROR_BASE + 1, tokenIdOutOfTop));
    }
}
