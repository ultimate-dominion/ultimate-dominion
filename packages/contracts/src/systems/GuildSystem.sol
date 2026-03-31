// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Guild,
    GuildData,
    GuildMember,
    GuildMemberData,
    GuildApplication,
    GuildCounter,
    GuildDescription,
    GuildStatBuffSlot,
    GuildStatBuffSlotData,
    GuildLevel,
    Characters,
    Admin
} from "@codegen/index.sol";
import {GuildRank, GuildStatBuff} from "@codegen/common.sol";
import {GoldLib} from "../libraries/GoldLib.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {_requireSystemOrAdmin} from "../utils.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances as ERC721Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/world/src/worldResourceTypes.sol";
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
    LeaderNotInactive,
    NotAdmin,
    InvalidBuffSlot,
    InvalidBuffType,
    DuplicateBuffType,
    GuildMaxLevel
} from "../Errors.sol";
import {
    GUILD_CREATE_COST,
    GUILD_MAX_MEMBERS,
    GUILD_MAX_TAX_RATE,
    GUILD_INACTIVITY_THRESHOLD,
    GUILD_BONUS_BPS,
    GUILD_BUFF_FLAT_STAT,
    GUILD_BUFF_FLAT_HP,
    GUILD_BUFF_DAILY_COST,
    GUILD_BUFF_PERIOD,
    GUILD_UPGRADE_LEVEL_2_COST,
    GUILD_UPGRADE_LEVEL_3_COST,
    GUILD_MAX_LEVEL,
    BADGE_GUILD_FOUNDER,
    BADGES_NAMESPACE
} from "../../constants.sol";

/**
 * @title GuildSystem
 * @notice Guild lifecycle, membership, treasury, tax, and flat bonuses.
 */
contract GuildSystem is System {

    event GuildCreated(uint256 indexed guildId, bytes32 indexed leader, string name);
    event GuildDisbanded(uint256 indexed guildId);
    event MemberJoined(uint256 indexed guildId, bytes32 indexed characterId);
    event MemberLeft(uint256 indexed guildId, bytes32 indexed characterId);
    event TaxCollected(uint256 indexed guildId, uint256 amount);
    event GuildBuffSet(uint256 indexed guildId, uint8 slotIndex, GuildStatBuff buffType);
    event GuildBuffDeactivated(uint256 indexed guildId, uint8 slotIndex);
    event GuildUpgraded(uint256 indexed guildId, uint256 newLevel);

    // ========== Lifecycle ==========

    function createGuild(
        bytes32 characterId,
        string memory name,
        string memory tag,
        bool isOpen,
        string memory description
    ) public returns (uint256 guildId) {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Not character owner");
        if (GuildMember.getGuildId(characterId) != 0) revert AlreadyInGuild();

        // Validate tag length
        bytes memory tagBytes = bytes(tag);
        if (tagBytes.length < 2 || tagBytes.length > 5) revert InvalidGuildTag();

        // Burn creation cost
        GoldLib.goldBurn(_world(), owner, GUILD_CREATE_COST);

        // Increment counter
        guildId = GuildCounter.getNextGuildId() + 1;
        GuildCounter.setNextGuildId(guildId);

        // Create guild
        Guild.set(guildId, GuildData({
            leader: characterId,
            taxRate: 0,
            treasury: 0,
            memberCount: 1,
            isOpen: isOpen,
            createdAt: block.timestamp,
            lifetimeGoldEarned: 0,
            name: name,
            tag: tag
        }));

        GuildDescription.set(guildId, description);

        // Set leader as first member
        GuildMember.set(characterId, GuildMemberData({
            guildId: guildId,
            rank: GuildRank.Leader,
            joinedAt: block.timestamp,
            lastActive: block.timestamp,
            seasonJoinedAt: block.timestamp
        }));

        // Mint The Pact badge to founder
        _mintPactBadge(characterId);

        emit GuildCreated(guildId, characterId, name);
    }

    function disbandGuild(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);

        // Refund treasury to leader
        uint256 treasury = Guild.getTreasury(guildId);
        if (treasury > 0) {
            address leaderOwner = Characters.getOwner(characterId);
            GoldLib.goldMint(_world(), leaderOwner, treasury);
        }

        // Note: individual member cleanup happens lazily — members check if guild still exists.
        // Clear leader's membership
        _clearMember(characterId);

        // Delete guild record
        Guild.deleteRecord(guildId);
        GuildDescription.deleteRecord(guildId);

        emit GuildDisbanded(guildId);
    }

    // ========== Membership ==========

    function joinGuild(bytes32 characterId, uint256 guildId) public {
        PauseLib.requireNotPaused();
        _requireOwner(characterId);
        if (GuildMember.getGuildId(characterId) != 0) revert AlreadyInGuild();
        if (Guild.getLeader(guildId) == bytes32(0)) revert GuildNotFound();
        if (!Guild.getIsOpen(guildId)) revert GuildNotOpen();
        if (Guild.getMemberCount(guildId) >= GUILD_MAX_MEMBERS) revert GuildFull();

        _addMember(characterId, guildId, GuildRank.Member);
        emit MemberJoined(guildId, characterId);
    }

    function applyToGuild(bytes32 characterId, uint256 guildId) public {
        PauseLib.requireNotPaused();
        _requireOwner(characterId);
        if (GuildMember.getGuildId(characterId) != 0) revert AlreadyInGuild();
        if (Guild.getLeader(guildId) == bytes32(0)) revert GuildNotFound();

        GuildApplication.set(characterId, guildId, block.timestamp);
    }

    function approveApplication(bytes32 officerCharId, bytes32 applicantCharId) public {
        PauseLib.requireNotPaused();
        _requireOfficerOrLeader(officerCharId);
        uint256 guildId = GuildMember.getGuildId(officerCharId);

        uint256 appliedAt = GuildApplication.getAppliedAt(applicantCharId, guildId);
        if (appliedAt == 0) revert NoApplicationFound();
        if (Guild.getMemberCount(guildId) >= GUILD_MAX_MEMBERS) revert GuildFull();

        GuildApplication.deleteRecord(applicantCharId, guildId);
        _addMember(applicantCharId, guildId, GuildRank.Member);
        emit MemberJoined(guildId, applicantCharId);
    }

    function rejectApplication(bytes32 officerCharId, bytes32 applicantCharId) public {
        PauseLib.requireNotPaused();
        _requireOfficerOrLeader(officerCharId);
        uint256 guildId = GuildMember.getGuildId(officerCharId);
        GuildApplication.deleteRecord(applicantCharId, guildId);
    }

    function leaveGuild(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        _requireOwner(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);
        if (guildId == 0) revert NotInGuild();

        // Leader cannot leave (must disband or transfer)
        GuildRank rank = GuildMember.getRank(characterId);
        if (rank == GuildRank.Leader) revert CannotKickLeader();

        uint256 newCount = Guild.getMemberCount(guildId) - 1;
        Guild.setMemberCount(guildId, newCount);
        _clearMember(characterId);

        emit MemberLeft(guildId, characterId);
    }

    function kickMember(bytes32 officerCharId, bytes32 targetCharId) public {
        PauseLib.requireNotPaused();
        _requireOfficerOrLeader(officerCharId);
        uint256 guildId = GuildMember.getGuildId(officerCharId);

        if (GuildMember.getGuildId(targetCharId) != guildId) revert NotInGuild();
        if (GuildMember.getRank(targetCharId) == GuildRank.Leader) revert CannotKickLeader();

        uint256 newCount = Guild.getMemberCount(guildId) - 1;
        Guild.setMemberCount(guildId, newCount);
        _clearMember(targetCharId);

        emit MemberLeft(guildId, targetCharId);
    }

    // ========== Management ==========

    function setTaxRate(bytes32 characterId, uint256 newRate) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        if (newRate > GUILD_MAX_TAX_RATE) revert TaxRateTooHigh();
        uint256 guildId = GuildMember.getGuildId(characterId);
        Guild.setTaxRate(guildId, newRate);
    }

    function setIsOpen(bytes32 characterId, bool isOpen) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);
        Guild.setIsOpen(guildId, isOpen);
    }

    function setDescription(bytes32 characterId, string memory description) public {
        PauseLib.requireNotPaused();
        _requireOfficerOrLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);
        GuildDescription.set(guildId, description);
    }

    function promoteMember(bytes32 leaderCharId, bytes32 targetCharId) public {
        PauseLib.requireNotPaused();
        _requireLeader(leaderCharId);
        uint256 guildId = GuildMember.getGuildId(leaderCharId);
        if (GuildMember.getGuildId(targetCharId) != guildId) revert NotInGuild();

        GuildRank currentRank = GuildMember.getRank(targetCharId);
        if (currentRank == GuildRank.Member) {
            GuildMember.setRank(targetCharId, GuildRank.Officer);
        }
        // Cannot promote to Leader via this function
    }

    function demoteMember(bytes32 leaderCharId, bytes32 targetCharId) public {
        PauseLib.requireNotPaused();
        _requireLeader(leaderCharId);
        uint256 guildId = GuildMember.getGuildId(leaderCharId);
        if (GuildMember.getGuildId(targetCharId) != guildId) revert NotInGuild();

        GuildRank currentRank = GuildMember.getRank(targetCharId);
        if (currentRank == GuildRank.Officer) {
            GuildMember.setRank(targetCharId, GuildRank.Member);
        }
    }

    // ========== Treasury ==========

    function withdrawTreasury(bytes32 characterId, uint256 amount) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);

        uint256 treasury = Guild.getTreasury(guildId);
        if (amount > treasury) revert InsufficientTreasury();

        Guild.setTreasury(guildId, treasury - amount);
        address leaderOwner = Characters.getOwner(characterId);
        GoldLib.goldMint(_world(), leaderOwner, amount);
    }

    /**
     * @notice Called by PveRewardSystem to apply guild tax on gold earnings.
     * @return taxAmount The amount taxed (deducted from player's share)
     */
    function taxGold(bytes32 characterId, uint256 goldAmount) public returns (uint256 taxAmount) {
        _requireSystemOrAdmin(_msgSender());

        uint256 guildId = GuildMember.getGuildId(characterId);
        if (guildId == 0) return 0;

        uint256 taxRate = Guild.getTaxRate(guildId);
        if (taxRate == 0) return 0;

        taxAmount = (goldAmount * taxRate) / 10000;
        if (taxAmount == 0) return 0;

        Guild.setTreasury(guildId, Guild.getTreasury(guildId) + taxAmount);
        Guild.setLifetimeGoldEarned(guildId, Guild.getLifetimeGoldEarned(guildId) + taxAmount);

        // Auto-renew guild stat buffs (lazy charge from treasury)
        if (gasleft() > 200_000) {
            _chargeGuildBuffs(guildId);
        }

        // Update member activity
        GuildMember.setLastActive(characterId, block.timestamp);

        emit TaxCollected(guildId, taxAmount);
    }

    // ========== Auto-Succession ==========

    function claimLeadership(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        _requireOwner(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);
        if (guildId == 0) revert NotInGuild();

        GuildRank rank = GuildMember.getRank(characterId);
        if (rank != GuildRank.Officer) revert NotGuildOfficer();

        bytes32 currentLeader = Guild.getLeader(guildId);
        uint256 lastActive = GuildMember.getLastActive(currentLeader);
        if (block.timestamp - lastActive < GUILD_INACTIVITY_THRESHOLD) revert LeaderNotInactive();

        // Transfer leadership
        GuildMember.setRank(currentLeader, GuildRank.Member);
        GuildMember.setRank(characterId, GuildRank.Leader);
        Guild.setLeader(guildId, characterId);
    }

    // ========== Stat Buffs ==========

    function setGuildBuff(bytes32 characterId, uint8 slotIndex, GuildStatBuff buffType) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);

        // Validate slot is unlocked by guild level
        uint256 guildLevel = _getGuildLevel(guildId);
        if (slotIndex >= guildLevel) revert InvalidBuffSlot();

        // Cannot set None — use removeGuildBuff instead
        if (buffType == GuildStatBuff.None) revert InvalidBuffType();

        // Same stat cannot occupy multiple slots
        for (uint8 i = 0; i < guildLevel; i++) {
            if (i == slotIndex) continue;
            GuildStatBuffSlotData memory existing = GuildStatBuffSlot.get(guildId, i);
            if (existing.active && existing.buffType == buffType) revert DuplicateBuffType();
        }

        // Charge first day from treasury
        uint256 treasury = Guild.getTreasury(guildId);
        if (treasury < GUILD_BUFF_DAILY_COST) revert InsufficientTreasury();
        Guild.setTreasury(guildId, treasury - GUILD_BUFF_DAILY_COST);

        GuildStatBuffSlot.set(guildId, slotIndex, GuildStatBuffSlotData({
            buffType: buffType,
            lastChargedAt: block.timestamp,
            activatedBy: characterId,
            active: true
        }));

        emit GuildBuffSet(guildId, slotIndex, buffType);
    }

    function removeGuildBuff(bytes32 characterId, uint8 slotIndex) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);

        GuildStatBuffSlot.set(guildId, slotIndex, GuildStatBuffSlotData({
            buffType: GuildStatBuff.None,
            lastChargedAt: 0,
            activatedBy: bytes32(0),
            active: false
        }));

        emit GuildBuffDeactivated(guildId, slotIndex);
    }

    // ========== Guild Upgrades ==========

    function upgradeGuild(bytes32 characterId) public {
        PauseLib.requireNotPaused();
        _requireLeader(characterId);
        uint256 guildId = GuildMember.getGuildId(characterId);

        uint256 currentLevel = _getGuildLevel(guildId);
        if (currentLevel >= GUILD_MAX_LEVEL) revert GuildMaxLevel();

        uint256 cost;
        if (currentLevel == 1) {
            cost = GUILD_UPGRADE_LEVEL_2_COST;
        } else {
            cost = GUILD_UPGRADE_LEVEL_3_COST;
        }

        uint256 treasury = Guild.getTreasury(guildId);
        if (treasury < cost) revert InsufficientTreasury();
        Guild.setTreasury(guildId, treasury - cost);

        uint256 newLevel = currentLevel + 1;
        GuildLevel.set(guildId, newLevel);

        emit GuildUpgraded(guildId, newLevel);
    }

    // ========== Views ==========

    function getGuildBonus() public pure returns (uint256 goldBonus, uint256 xpBonus, uint256 dropBonus) {
        return (GUILD_BONUS_BPS, GUILD_BONUS_BPS, GUILD_BONUS_BPS);
    }

    function isGuildMember(bytes32 characterId) public view returns (bool) {
        return GuildMember.getGuildId(characterId) != 0;
    }

    /// @notice Returns flat stat bonuses from active guild buffs for a character.
    /// @dev Called by EquipmentSystem.getCombatStats via staticcall.
    function getGuildBuffStats(bytes32 characterId)
        public
        view
        returns (int256 strBuff, int256 agiBuff, int256 intBuff, int256 hpBuff)
    {
        uint256 guildId = GuildMember.getGuildId(characterId);
        if (guildId == 0) return (0, 0, 0, 0);

        uint256 guildLevel = _getGuildLevel(guildId);

        for (uint8 i = 0; i < guildLevel; i++) {
            GuildStatBuffSlotData memory slot = GuildStatBuffSlot.get(guildId, i);
            if (!slot.active) continue;

            if (slot.buffType == GuildStatBuff.Strength) {
                strBuff += GUILD_BUFF_FLAT_STAT;
            } else if (slot.buffType == GuildStatBuff.Agility) {
                agiBuff += GUILD_BUFF_FLAT_STAT;
            } else if (slot.buffType == GuildStatBuff.Intelligence) {
                intBuff += GUILD_BUFF_FLAT_STAT;
            } else if (slot.buffType == GuildStatBuff.Resilience) {
                hpBuff += GUILD_BUFF_FLAT_HP;
            }
        }
    }

    // ========== Internal ==========

    function _requireOwner(bytes32 characterId) internal view {
        require(Characters.getOwner(characterId) == _msgSender(), "Not character owner");
    }

    function _requireLeader(bytes32 characterId) internal view {
        _requireOwner(characterId);
        if (GuildMember.getRank(characterId) != GuildRank.Leader) revert NotGuildLeader();
    }

    function _requireOfficerOrLeader(bytes32 characterId) internal view {
        _requireOwner(characterId);
        GuildRank rank = GuildMember.getRank(characterId);
        if (rank != GuildRank.Officer && rank != GuildRank.Leader) revert NotGuildOfficer();
    }

    function _addMember(bytes32 characterId, uint256 guildId, GuildRank rank) internal {
        GuildMember.set(characterId, GuildMemberData({
            guildId: guildId,
            rank: rank,
            joinedAt: block.timestamp,
            lastActive: block.timestamp,
            seasonJoinedAt: block.timestamp
        }));
        Guild.setMemberCount(guildId, Guild.getMemberCount(guildId) + 1);
    }

    function _clearMember(bytes32 characterId) internal {
        GuildMember.set(characterId, GuildMemberData({
            guildId: 0,
            rank: GuildRank.None,
            joinedAt: 0,
            lastActive: 0,
            seasonJoinedAt: 0
        }));
    }

    function _getGuildLevel(uint256 guildId) internal view returns (uint256) {
        uint256 level = GuildLevel.getLevel(guildId);
        return level == 0 ? 1 : level; // Default to 1 for guilds created before upgrades
    }

    /// @dev Lazy auto-renewal: charge treasury for elapsed buff periods.
    ///      Called from taxGold on every PvE gold earn.
    function _chargeGuildBuffs(uint256 guildId) internal {
        uint256 guildLevel = _getGuildLevel(guildId);
        uint256 treasury = Guild.getTreasury(guildId);

        for (uint8 i = 0; i < guildLevel; i++) {
            GuildStatBuffSlotData memory slot = GuildStatBuffSlot.get(guildId, i);
            if (!slot.active) continue;

            uint256 elapsed = block.timestamp - slot.lastChargedAt;
            if (elapsed < GUILD_BUFF_PERIOD) continue;

            uint256 periodsOwed = elapsed / GUILD_BUFF_PERIOD;
            uint256 totalCost = periodsOwed * GUILD_BUFF_DAILY_COST;

            if (treasury >= totalCost) {
                treasury -= totalCost;
                Guild.setTreasury(guildId, treasury);
                // Advance by exact period multiples to prevent drift
                GuildStatBuffSlot.setLastChargedAt(guildId, i, slot.lastChargedAt + (periodsOwed * GUILD_BUFF_PERIOD));
            } else {
                // Cannot afford — deactivate this buff
                GuildStatBuffSlot.setActive(guildId, i, false);
                emit GuildBuffDeactivated(guildId, i);
            }
        }
    }

    function _mintPactBadge(bytes32 characterId) internal {
        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 badgeId = (BADGE_GUILD_FOUNDER * 1_000_000) + tokenId;

        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId balancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        // Idempotent: skip if already minted
        address existing = ERC721Owners.get(ownersTableId, badgeId);
        if (existing != address(0)) return;

        ERC721Owners.set(ownersTableId, badgeId, owner);
        uint256 currentBalance = ERC721Balances.get(balancesTableId, owner);
        ERC721Balances.set(balancesTableId, owner, currentBalance + 1);
    }
}
