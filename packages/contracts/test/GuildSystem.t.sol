// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {SetUp} from "./SetUp.sol";
import {
    Guild,
    GuildMember,
    GuildApplication,
    GuildCounter,
    GuildDescription,
    Characters
} from "@codegen/index.sol";
import {GuildRank, Classes} from "@codegen/common.sol";
import {
    AlreadyInGuild,
    NotInGuild,
    GuildNotFound,
    GuildFull,
    GuildNotOpen,
    NotGuildLeader,
    NotGuildOfficer,
    CannotKickLeader,
    TaxRateTooHigh,
    InsufficientTreasury,
    NoApplicationFound,
    InvalidGuildTag,
    LeaderNotInactive
} from "../src/Errors.sol";
import {
    GUILD_CREATE_COST,
    GUILD_MAX_TAX_RATE,
    GUILD_INACTIVITY_THRESHOLD,
    GUILD_BONUS_BPS
} from "../constants.sol";

contract GuildSystemTest is SetUp {
    // Mirror events from GuildSystem so we can use vm.expectEmit
    event GuildCreated(uint256 indexed guildId, bytes32 indexed leader, string name);
    event GuildDisbanded(uint256 indexed guildId);
    event MemberJoined(uint256 indexed guildId, bytes32 indexed characterId);
    event MemberLeft(uint256 indexed guildId, bytes32 indexed characterId);
    event TaxCollected(uint256 indexed guildId, uint256 amount);

    // Extra test addresses
    address payable public charlie;
    address payable public dave;

    // Extra character IDs
    bytes32 public charlieCharId;
    bytes32 public daveCharId;

    function setUp() public override {
        super.setUp();

        // Complete alice's character setup (SetUp only mints, no rollStats/enterGame)
        vm.startPrank(alice);
        world.UD__rollStats(bytes32(keccak256("aliceRng")), alicesCharacterId, Classes.Warrior);
        world.UD__enterGame(alicesCharacterId, newWeaponId, newArmorId);
        vm.stopPrank();

        // Create charlie and dave with full game entry
        charlie = getUser();
        dave = getUser();
        vm.label(charlie, "charlie");
        vm.label(dave, "dave");

        charlieCharId = _createCharAndEnter(charlie, "Charlie");
        daveCharId = _createCharAndEnter(dave, "Dave");
    }

    // ==================== Helpers ====================

    function _giveGold(bytes32 characterId, uint256 amount) internal {
        vm.prank(deployer);
        world.UD__adminDropGold(characterId, amount);
    }

    function _createTestGuild(bytes32 characterId, address owner, bool isOpen) internal returns (uint256) {
        _giveGold(characterId, GUILD_CREATE_COST);
        vm.prank(owner);
        return world.UD__createGuild(characterId, "TestGuild", "TG", isOpen, "A test guild");
    }

    function _createCharAndEnter(address user, string memory name) internal returns (bytes32) {
        vm.startPrank(user);
        bytes32 charId = world.UD__mintCharacter(user, bytes32(abi.encodePacked(name)), "test_uri");
        world.UD__rollStats(bytes32(keccak256(abi.encode(user))), charId, Classes.Warrior);
        world.UD__enterGame(charId, newWeaponId, newArmorId);
        vm.stopPrank();
        return charId;
    }

    // ==================== Lifecycle ====================

    function test_createGuild_succeeds() public {
        _giveGold(bobCharacterId, GUILD_CREATE_COST);

        uint256 goldBefore = goldToken.balanceOf(bob);
        uint256 counterBefore = GuildCounter.getNextGuildId();

        vm.expectEmit(true, true, false, true);
        emit GuildCreated(counterBefore + 1, bobCharacterId, "MyGuild");

        vm.prank(bob);
        uint256 guildId = world.UD__createGuild(bobCharacterId, "MyGuild", "MG", true, "My guild description");

        // Guild ID incremented
        assertEq(guildId, counterBefore + 1, "Guild ID should be counter + 1");
        assertEq(GuildCounter.getNextGuildId(), guildId, "Counter should update");

        // Gold burned
        uint256 goldAfter = goldToken.balanceOf(bob);
        assertEq(goldBefore - goldAfter, GUILD_CREATE_COST, "Should burn GUILD_CREATE_COST gold");

        // Guild data set correctly
        assertEq(Guild.getLeader(guildId), bobCharacterId, "Leader should be bob");
        assertEq(Guild.getMemberCount(guildId), 1, "Member count should be 1");
        assertTrue(Guild.getIsOpen(guildId), "Guild should be open");
        assertEq(Guild.getTaxRate(guildId), 0, "Tax rate should be 0");
        assertEq(Guild.getTreasury(guildId), 0, "Treasury should be 0");

        // Leader membership set
        assertEq(GuildMember.getGuildId(bobCharacterId), guildId, "Bob should be in guild");
        assertEq(uint8(GuildMember.getRank(bobCharacterId)), uint8(GuildRank.Leader), "Bob should be Leader");

        // Description set
        assertEq(GuildDescription.get(guildId), "My guild description", "Description should match");
    }

    function test_createGuild_revertsAlreadyInGuild() public {
        _createTestGuild(bobCharacterId, bob, true);

        // Try creating a second guild with the same character
        _giveGold(bobCharacterId, GUILD_CREATE_COST);
        vm.prank(bob);
        vm.expectRevert(AlreadyInGuild.selector);
        world.UD__createGuild(bobCharacterId, "SecondGuild", "SG", true, "desc");
    }

    function test_createGuild_revertsInvalidTag() public {
        _giveGold(bobCharacterId, GUILD_CREATE_COST);

        // Tag too short (1 char)
        vm.prank(bob);
        vm.expectRevert(InvalidGuildTag.selector);
        world.UD__createGuild(bobCharacterId, "Guild", "X", true, "desc");

        // Tag too long (6 chars)
        vm.prank(bob);
        vm.expectRevert(InvalidGuildTag.selector);
        world.UD__createGuild(bobCharacterId, "Guild", "ABCDEF", true, "desc");
    }

    function test_disbandGuild_refundsTreasury() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Seed the treasury by setting a tax rate, adding a member, and taxing gold
        vm.prank(bob);
        world.UD__setTaxRate(bobCharacterId, 1000); // 10%

        // Directly set treasury for simplicity (as deployer/admin)
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
        Guild.setTreasury(guildId, 50 ether);

        uint256 goldBefore = goldToken.balanceOf(bob);

        vm.prank(bob);
        world.UD__disbandGuild(bobCharacterId);

        uint256 goldAfter = goldToken.balanceOf(bob);
        assertEq(goldAfter - goldBefore, 50 ether, "Leader should receive treasury refund");

        // Guild record deleted
        assertEq(Guild.getLeader(guildId), bytes32(0), "Guild leader should be cleared");

        // Leader membership cleared
        assertEq(GuildMember.getGuildId(bobCharacterId), 0, "Bob should no longer be in a guild");
    }

    // ==================== Membership ====================

    function test_joinGuild_openGuild() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        vm.expectEmit(true, true, false, false);
        emit MemberJoined(guildId, alicesCharacterId);

        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);

        assertEq(GuildMember.getGuildId(alicesCharacterId), guildId, "Alice should be in guild");
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Member), "Alice should be Member rank");
        assertEq(Guild.getMemberCount(guildId), 2, "Member count should be 2");
    }

    function test_joinGuild_revertsClosedGuild() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, false);

        vm.prank(alice);
        vm.expectRevert(GuildNotOpen.selector);
        world.UD__joinGuild(alicesCharacterId, guildId);
    }

    function test_applyAndApprove_closedGuild() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, false);

        // Alice applies
        vm.prank(alice);
        world.UD__applyToGuild(alicesCharacterId, guildId);

        // Verify application exists
        uint256 appliedAt = GuildApplication.getAppliedAt(alicesCharacterId, guildId);
        assertGt(appliedAt, 0, "Application should exist");

        // Leader (bob) approves
        vm.expectEmit(true, true, false, false);
        emit MemberJoined(guildId, alicesCharacterId);

        vm.prank(bob);
        world.UD__approveApplication(bobCharacterId, alicesCharacterId);

        // Alice is now a member
        assertEq(GuildMember.getGuildId(alicesCharacterId), guildId, "Alice should be in guild");
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Member), "Alice should be Member");
        assertEq(Guild.getMemberCount(guildId), 2, "Member count should be 2");

        // Application deleted
        assertEq(GuildApplication.getAppliedAt(alicesCharacterId, guildId), 0, "Application should be deleted");
    }

    function test_leaveGuild_memberLeaves() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Alice joins
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);
        assertEq(Guild.getMemberCount(guildId), 2, "Should have 2 members");

        // Alice leaves
        vm.expectEmit(true, true, false, false);
        emit MemberLeft(guildId, alicesCharacterId);

        vm.prank(alice);
        world.UD__leaveGuild(alicesCharacterId);

        assertEq(GuildMember.getGuildId(alicesCharacterId), 0, "Alice should not be in guild");
        assertEq(Guild.getMemberCount(guildId), 1, "Member count should decrease to 1");
    }

    function test_leaveGuild_revertsForLeader() public {
        _createTestGuild(bobCharacterId, bob, true);

        vm.prank(bob);
        vm.expectRevert(CannotKickLeader.selector);
        world.UD__leaveGuild(bobCharacterId);
    }

    function test_kickMember_officerKicks() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Alice and Charlie join
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);
        vm.prank(charlie);
        world.UD__joinGuild(charlieCharId, guildId);
        assertEq(Guild.getMemberCount(guildId), 3, "Should have 3 members");

        // Promote alice to officer
        vm.prank(bob);
        world.UD__promoteMember(bobCharacterId, alicesCharacterId);

        // Alice (officer) kicks charlie
        vm.expectEmit(true, true, false, false);
        emit MemberLeft(guildId, charlieCharId);

        vm.prank(alice);
        world.UD__kickMember(alicesCharacterId, charlieCharId);

        assertEq(GuildMember.getGuildId(charlieCharId), 0, "Charlie should be kicked");
        assertEq(Guild.getMemberCount(guildId), 2, "Member count should decrease to 2");
    }

    function test_kickMember_revertsKickLeader() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Alice joins and gets promoted to officer
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);
        vm.prank(bob);
        world.UD__promoteMember(bobCharacterId, alicesCharacterId);

        // Alice (officer) tries to kick bob (leader)
        vm.prank(alice);
        vm.expectRevert(CannotKickLeader.selector);
        world.UD__kickMember(alicesCharacterId, bobCharacterId);
    }

    // ==================== Management ====================

    function test_setTaxRate_leaderSets() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        vm.prank(bob);
        world.UD__setTaxRate(bobCharacterId, 2500); // 25%

        assertEq(Guild.getTaxRate(guildId), 2500, "Tax rate should be 2500 bp");
    }

    function test_setTaxRate_revertsTooHigh() public {
        _createTestGuild(bobCharacterId, bob, true);

        vm.prank(bob);
        vm.expectRevert(TaxRateTooHigh.selector);
        world.UD__setTaxRate(bobCharacterId, GUILD_MAX_TAX_RATE + 1);
    }

    function test_promoteDemote_works() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Alice joins
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Member), "Should start as Member");

        // Promote to officer
        vm.prank(bob);
        world.UD__promoteMember(bobCharacterId, alicesCharacterId);
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Officer), "Should be Officer after promote");

        // Demote back to member
        vm.prank(bob);
        world.UD__demoteMember(bobCharacterId, alicesCharacterId);
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Member), "Should be Member after demote");
    }

    // ==================== Treasury ====================

    function test_withdrawTreasury_leaderWithdraws() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Seed treasury directly
        vm.prank(deployer);
        world.UD__setAdmin(address(this), true);
        Guild.setTreasury(guildId, 30 ether);

        uint256 goldBefore = goldToken.balanceOf(bob);

        vm.prank(bob);
        world.UD__withdrawTreasury(bobCharacterId, 20 ether);

        uint256 goldAfter = goldToken.balanceOf(bob);
        assertEq(goldAfter - goldBefore, 20 ether, "Leader should receive withdrawn gold");
        assertEq(Guild.getTreasury(guildId), 10 ether, "Treasury should decrease by withdrawal amount");
    }

    function test_taxGold_calculatesCorrectly() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Set 10% tax rate
        vm.prank(bob);
        world.UD__setTaxRate(bobCharacterId, 1000); // 1000 bp = 10%

        // Alice joins
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);

        // Call taxGold as deployer (admin)
        uint256 goldAmount = 100 ether;
        uint256 expectedTax = (goldAmount * 1000) / 10000; // 10 ether

        vm.expectEmit(true, false, false, true);
        emit TaxCollected(guildId, expectedTax);

        vm.prank(deployer);
        uint256 taxAmount = world.UD__taxGold(alicesCharacterId, goldAmount);

        assertEq(taxAmount, expectedTax, "Tax should be 10% of gold amount");
        assertEq(taxAmount, 10 ether, "Tax should be 10 ether");
        assertEq(Guild.getTreasury(guildId), expectedTax, "Treasury should increase by tax amount");
        assertEq(Guild.getLifetimeGoldEarned(guildId), expectedTax, "Lifetime earned should increase");
    }

    // ==================== Auto-Succession ====================

    function test_claimLeadership_afterInactivity() public {
        uint256 guildId = _createTestGuild(bobCharacterId, bob, true);

        // Alice joins and gets promoted to officer
        vm.prank(alice);
        world.UD__joinGuild(alicesCharacterId, guildId);
        vm.prank(bob);
        world.UD__promoteMember(bobCharacterId, alicesCharacterId);

        // Verify alice is officer
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Officer), "Alice should be Officer");

        // Warp past inactivity threshold
        vm.warp(block.timestamp + GUILD_INACTIVITY_THRESHOLD + 1);

        // Alice claims leadership
        vm.prank(alice);
        world.UD__claimLeadership(alicesCharacterId);

        // Alice is now leader
        assertEq(uint8(GuildMember.getRank(alicesCharacterId)), uint8(GuildRank.Leader), "Alice should be Leader");
        assertEq(Guild.getLeader(guildId), alicesCharacterId, "Guild leader should be alice");

        // Bob demoted to member
        assertEq(uint8(GuildMember.getRank(bobCharacterId)), uint8(GuildRank.Member), "Bob should be demoted to Member");
    }
}
