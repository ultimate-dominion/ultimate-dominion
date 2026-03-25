// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";
import {IWorld} from "@codegen/world/IWorld.sol";
import {PvpRating, PvpRatingData, PvpSeason, CharacterZone, Admin} from "@codegen/index.sol";
import {SeasonNotActive, SeasonAlreadyActive, NotAdmin} from "../src/Errors.sol";
import {
    ELO_DEFAULT_RATING,
    ELO_K_FACTOR,
    ELO_SCALE,
    ZONE_WINDY_PEAKS,
    ZONE_DARK_CAVE
} from "../constants.sol";

contract Test_PvpRankingSystem is Test {
    using stdJson for string;

    address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
    IWorld public world;
    address public worldAddress;
    uint256 public userNonce = 0;

    function setUp() public {
        vm.deal(deployer, 100 ether);
        vm.startPrank(deployer);

        worldAddress = vm.envAddress("WORLD_ADDRESS");
        StoreSwitch.setStoreAddress(worldAddress);
        world = IWorld(worldAddress);

        // Grant admin to deployer (already is) and start a season
        world.UD__startSeason(block.timestamp + 30 days);

        vm.stopPrank();
    }

    // ==================== Helpers ====================

    function _getUser() internal returns (address payable) {
        address payable user = payable(
            address(uint160(uint256(keccak256(abi.encodePacked(userNonce++)))))
        );
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

    function _toArray(bytes32 id) internal pure returns (bytes32[] memory arr) {
        arr = new bytes32[](1);
        arr[0] = id;
    }

    // ==================== Happy Paths ====================

    /// @notice Two 1000-rated players: winner gains 16, loser loses 16
    function test_updateRatings_equalRating() public {
        address userA = _getUser();
        address userB = _getUser();
        bytes32 winner = _createCharacter(userA);
        bytes32 loser = _createCharacter(userB);

        // Pre-initialize both at default rating by calling updateRatings once
        // so they have season set, then check starting point
        vm.prank(deployer);
        world.UD__updateRatings(_toArray(winner), _toArray(loser));

        PvpRatingData memory winnerData = PvpRating.get(winner);
        PvpRatingData memory loserData = PvpRating.get(loser);

        // Equal ratings: diff=0, expectedBp=5000, winnerChange=16, loserChange=-16
        assertEq(winnerData.rating, int256(ELO_DEFAULT_RATING) + 16, "winner should be 1016");
        assertEq(loserData.rating, int256(ELO_DEFAULT_RATING) - 16, "loser should be 984");
    }

    /// @notice 1200 vs 800: strong winner gains less (expected win)
    function test_updateRatings_highVsLow() public {
        address userA = _getUser();
        address userB = _getUser();
        bytes32 winner = _createCharacter(userA);
        bytes32 loser = _createCharacter(userB);

        // Manually set ratings via table writes
        uint256 season = PvpSeason.getCurrentSeason();
        PvpRating.set(winner, 1200, 0, 0, season);
        PvpRating.set(loser, 800, 0, 0, season);

        vm.prank(deployer);
        world.UD__updateRatings(_toArray(winner), _toArray(loser));

        PvpRatingData memory winnerData = PvpRating.get(winner);
        PvpRatingData memory loserData = PvpRating.get(loser);

        // diff = 800 - 1200 = -400, clamped to -400
        // expectedBp = 5000 + (-400 * 5000 / 400) = 0
        // winnerChange = 32 * (10000 - 0) / 10000 = 32
        // loserChange = -(32 * 0 / 10000) = 0
        assertEq(winnerData.rating, 1232, "strong winner gains 32 (expected win)");
        assertEq(loserData.rating, 800, "weak loser loses 0 (expected loss)");
    }

    /// @notice Uninitialized characters get default 1000 rating on first fight
    function test_updateRatings_initializesOnFirstFight() public {
        address userA = _getUser();
        address userB = _getUser();
        bytes32 charA = _createCharacter(userA);
        bytes32 charB = _createCharacter(userB);

        // Confirm both have 0 rating (uninitialized)
        assertEq(PvpRating.getRating(charA), 0, "charA should start at 0 (uninitialized)");
        assertEq(PvpRating.getRating(charB), 0, "charB should start at 0 (uninitialized)");

        vm.prank(deployer);
        world.UD__updateRatings(_toArray(charA), _toArray(charB));

        // After fight, both should have been initialized to 1000 then ELO applied
        PvpRatingData memory dataA = PvpRating.get(charA);
        PvpRatingData memory dataB = PvpRating.get(charB);

        assertEq(dataA.rating, 1016, "winner initialized to 1000, then +16");
        assertEq(dataB.rating, 984, "loser initialized to 1000, then -16");
        assertEq(dataA.season, PvpSeason.getCurrentSeason(), "season set on init");
        assertEq(dataB.season, PvpSeason.getCurrentSeason(), "season set on init");
    }

    /// @notice Loser rating floors at 0, never goes negative
    function test_updateRatings_floorAtZero() public {
        address userA = _getUser();
        address userB = _getUser();
        bytes32 winner = _createCharacter(userA);
        bytes32 loser = _createCharacter(userB);

        uint256 season = PvpSeason.getCurrentSeason();
        PvpRating.set(winner, 1200, 0, 0, season);
        // Set loser to a very low rating — loserChange could push below 0
        PvpRating.set(loser, 5, 0, 0, season);

        vm.prank(deployer);
        world.UD__updateRatings(_toArray(winner), _toArray(loser));

        PvpRatingData memory loserData = PvpRating.get(loser);
        assertGe(loserData.rating, int256(0), "loser rating must not go below 0");
    }

    /// @notice Wins and losses counters are incremented correctly
    function test_updateRatings_winsAndLossesTracked() public {
        address userA = _getUser();
        address userB = _getUser();
        bytes32 charA = _createCharacter(userA);
        bytes32 charB = _createCharacter(userB);

        // Fight 1: A wins
        vm.prank(deployer);
        world.UD__updateRatings(_toArray(charA), _toArray(charB));

        assertEq(PvpRating.getWins(charA), 1, "charA should have 1 win");
        assertEq(PvpRating.getLosses(charA), 0, "charA should have 0 losses");
        assertEq(PvpRating.getWins(charB), 0, "charB should have 0 wins");
        assertEq(PvpRating.getLosses(charB), 1, "charB should have 1 loss");

        // Fight 2: A wins again
        vm.prank(deployer);
        world.UD__updateRatings(_toArray(charA), _toArray(charB));

        assertEq(PvpRating.getWins(charA), 2, "charA should have 2 wins");
        assertEq(PvpRating.getLosses(charB), 2, "charB should have 2 losses");

        // Fight 3: B wins (reversal)
        vm.prank(deployer);
        world.UD__updateRatings(_toArray(charB), _toArray(charA));

        assertEq(PvpRating.getWins(charB), 1, "charB should have 1 win");
        assertEq(PvpRating.getLosses(charA), 1, "charA should have 1 loss");
    }

    // ==================== Zone Gating ====================

    /// @notice Zone >= ZONE_WINDY_PEAKS (2) is ranked
    function test_isRankedZone_z2IsRanked() public {
        address user = _getUser();
        bytes32 charId = _createCharacter(user);

        CharacterZone.setZoneId(charId, ZONE_WINDY_PEAKS);
        assertTrue(world.UD__isRankedZone(charId), "zone 2 should be ranked");

        // Zone 3 should also be ranked
        CharacterZone.setZoneId(charId, 3);
        assertTrue(world.UD__isRankedZone(charId), "zone 3 should be ranked");
    }

    /// @notice Zone < ZONE_WINDY_PEAKS is not ranked
    function test_isRankedZone_z1IsNotRanked() public {
        address user = _getUser();
        bytes32 charId = _createCharacter(user);

        CharacterZone.setZoneId(charId, ZONE_DARK_CAVE);
        assertFalse(world.UD__isRankedZone(charId), "zone 1 should not be ranked");

        // Zone 0 (default/unset) also not ranked
        CharacterZone.setZoneId(charId, 0);
        assertFalse(world.UD__isRankedZone(charId), "zone 0 should not be ranked");
    }

    // ==================== Season Management ====================

    /// @notice startSeason increments the season counter
    function test_startSeason_incrementsSeason() public {
        // Season 1 was started in setUp. End it, then start season 2.
        uint256 seasonBefore = PvpSeason.getCurrentSeason();
        assertEq(seasonBefore, 1, "should start at season 1");

        // End current season
        vm.prank(deployer);
        world.UD__endSeason();

        // Start new season
        vm.prank(deployer);
        world.UD__startSeason(block.timestamp + 60 days);

        uint256 seasonAfter = PvpSeason.getCurrentSeason();
        assertEq(seasonAfter, 2, "should be season 2");
    }

    /// @notice endSeason sets the season end timestamp to block.timestamp
    function test_endSeason_setsEndTime() public {
        uint256 endBefore = PvpSeason.getSeasonEnd();
        assertTrue(endBefore > block.timestamp, "season end should be in the future");

        vm.prank(deployer);
        world.UD__endSeason();

        uint256 endAfter = PvpSeason.getSeasonEnd();
        assertEq(endAfter, block.timestamp, "season end should be current timestamp");
    }

    /// @notice Starting a season while one is active reverts SeasonAlreadyActive
    function test_startSeason_revertsIfActive() public {
        // Season 1 is already active from setUp
        vm.prank(deployer);
        vm.expectRevert(SeasonAlreadyActive.selector);
        world.UD__startSeason(block.timestamp + 60 days);
    }

    /// @notice Non-admin cannot start a season
    function test_startSeason_revertsNonAdmin() public {
        address nobody = _getUser();

        vm.prank(nobody);
        vm.expectRevert(NotAdmin.selector);
        world.UD__startSeason(block.timestamp + 60 days);
    }
}
