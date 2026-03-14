// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Admin,
    Levels,
    Stats,
    Characters,
    CharactersData,
    StatsData,
    ZoneCompletions,
    CharacterZoneCompletion,
    ZoneConfig,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {Classes, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {IWorld} from "@world/IWorld.sol";
import {StatCalculator} from "@libraries/StatCalculator.sol";
import {MAX_LEVEL, ADVENTURER_BADGE_LEVEL, BADGE_ADVENTURER, BADGE_FOUNDER, BADGES_NAMESPACE, MAX_ZONE_CONQUEROR_BADGES, ZONE_DARK_CAVE, POWER_SOURCE_BONUS_LEVEL} from "../../../constants.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances as ERC721Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {ResourceId, WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {_requireAccess} from "../../utils.sol";
import {AdjustedCombatStats} from "@interfaces/Structs.sol";
import {PauseLib} from "../../libraries/PauseLib.sol";
import {NotAdmin} from "../../Errors.sol";

/**
 * @title LevelSystem
 * @dev Handles character leveling mechanics including level progression, stat bonuses, and validation
 */
contract LevelSystem is System {
    using StatCalculator for *;

    // Events
    event CharacterLeveledUp(bytes32 indexed characterId, uint256 newLevel, uint256 experience);
    event LevelBonusApplied(bytes32 indexed characterId, uint256 statType, int256 bonus);

    // Errors
    error LevelSystem_CharacterNotFound();
    error LevelSystem_InvalidLevel();
    error LevelSystem_InvalidStatChanges();
    error LevelSystem_CharacterInCombat();
    error LevelSystem_MaxLevelReached();
    error LevelSystem_InsufficientExperience();

    /**
     * @dev Levels up a character with the provided stat distribution
     * @param characterId The character to level up
     * @param desiredStats The desired stat distribution for the level up
     */
    function UD__levelCharacter(bytes32 characterId, StatsData memory desiredStats) public {
        PauseLib.requireNotPaused();
        // Validate character exists
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert LevelSystem_CharacterNotFound();
        }

        // Check if character is in combat
        if (IWorld(_world()).UD__isInEncounter(characterId)) {
            revert LevelSystem_CharacterInCombat();
        }

        // Get current stats — sync experience from Stats table because
        // PveRewardSystem only updates Stats, not Characters.baseStats
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.currentHp = Stats.getCurrentHp(characterId);
        stats.experience = Stats.getExperience(characterId);
        
        // Check if already at max level
        if (stats.level >= MAX_LEVEL) {
            revert LevelSystem_MaxLevelReached();
        }

        // Calculate available level based on experience
        uint256 availableLevel = UD__getCurrentAvailableLevel(stats.experience);
        
        // Check if character can level up
        if (availableLevel <= stats.level) {
            revert LevelSystem_InsufficientExperience();
        }

        // Validate stat changes using new level
        uint256 newLevel = stats.level + 1;
        if (!StatCalculator.validateStatChanges(stats, desiredStats, newLevel)) {
            revert LevelSystem_InvalidStatChanges();
        }

        // Process the level up
        processLevelUp(characterId, stats, desiredStats, newLevel);
    }

    /**
     * @dev Calculates level bonuses for a character using diminishing returns
     * @param characterId The character to calculate bonuses for
     * @return statPoints Number of stat points available for the next level
     * @return hpGain HP gained for the next level
     */
    function calculateLevelBonuses(bytes32 characterId) public view returns (
        int256 statPoints,
        int256 hpGain
    ) {
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        uint256 nextLevel = stats.level + 1;

        // Calculate stat points for next level using diminishing returns
        statPoints = StatCalculator.calculateStatPointsForLevel(nextLevel);

        // Calculate HP gain for next level using diminishing returns
        hpGain = StatCalculator.calculateHpForLevel(nextLevel);
    }

    /**
     * @dev Validates level requirements for a character
     * @param characterId The character to validate
     * @param desiredStats The desired stat distribution
     * @return isValid Whether the level requirements are met
     */
    function validateLevelRequirements(bytes32 characterId, StatsData memory desiredStats) public view returns (bool isValid) {
        StatsData memory stats = abi.decode(Characters.getBaseStats(characterId), (StatsData));
        stats.experience = Stats.getExperience(characterId);
        uint256 availableLevel = UD__getCurrentAvailableLevel(stats.experience);

        // Check if character can level up
        if (availableLevel <= stats.level) {
            return false;
        }

        // Validate stat changes using new level
        uint256 newLevel = stats.level + 1;
        return StatCalculator.validateStatChanges(stats, desiredStats, newLevel);
    }

    /**
     * @dev Processes a character level up with diminishing returns
     * @param characterId The character to level up
     * @param currentStats Current character stats
     * @param desiredStats Desired stat distribution
     * @param newLevel The new level being attained
     */
    function processLevelUp(bytes32 characterId, StatsData memory currentStats, StatsData memory desiredStats, uint256 newLevel) internal {
        // Calculate and apply HP gain using diminishing returns
        int256 hpGain = StatCalculator.calculateHpForLevel(newLevel);
        if (hpGain > 0) {
            currentStats.maxHp = currentStats.maxHp + hpGain;
            emit LevelBonusApplied(characterId, 3, hpGain); // 3 = HP
        }

        // Update stats — sync experience from Stats table so baseStats stays current
        currentStats.strength = desiredStats.strength;
        currentStats.agility = desiredStats.agility;
        currentStats.intelligence = desiredStats.intelligence;
        currentStats.level = newLevel;
        currentStats.experience = Stats.getExperience(characterId);

        // Power source milestone bonus at level 5
        if (newLevel == POWER_SOURCE_BONUS_LEVEL) {
            if (currentStats.powerSource == PowerSource.Divine) {
                currentStats.maxHp += 2;
            } else if (currentStats.powerSource == PowerSource.Weave) {
                currentStats.intelligence += 1;
            }
            // Physical: extra ability point handled in validateStatChanges
        }

        // Update character base stats
        Characters.setBaseStats(characterId, abi.encode(currentStats));

        // Apply equipment bonuses and set them to stat table
        AdjustedCombatStats memory equipmentBonuses = IWorld(_world()).UD__calculateEquipmentBonuses(characterId);
        _setStats(characterId, equipmentBonuses, currentStats.level);

        // Re-apply world effects
        IWorld(_world()).UD__applyWorldEffects(characterId);

        // Mint Adventurer badge at level 3 (unlocks chat)
        if (newLevel == ADVENTURER_BADGE_LEVEL) {
            _mintAdventurerBadge(characterId);
            _tryMintFounderBadge(characterId);
        }

        // Check for zone completion (Zone Conqueror badge)
        _checkZoneCompletion(characterId, newLevel);

        emit CharacterLeveledUp(characterId, currentStats.level, currentStats.experience);
    }

    /**
     * @dev Mints the Adventurer badge to a character's owner
     * @param characterId The character that reached the badge level
     */
    function _mintAdventurerBadge(bytes32 characterId) internal {
        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 badgeId = (BADGE_ADVENTURER * 1_000_000) + tokenId;
        _mintBadgeDirect(owner, badgeId);
    }

    /**
     * @dev Mints a Founder badge if the current timestamp is before founderWindowEnd.
     * Triggered at the same level as Adventurer badge (level 3) — requires actual gameplay.
     * @param characterId The character that reached the badge level
     */
    function _tryMintFounderBadge(bytes32 characterId) internal {
        uint256 founderWindowEnd = UltimateDominionConfig.getFounderWindowEnd();
        if (founderWindowEnd == 0 || block.timestamp >= founderWindowEnd) return;

        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 badgeId = (BADGE_FOUNDER * 1_000_000) + tokenId;

        // try/catch in case badge already exists
        try this._mintBadgeExternal(owner, badgeId) {} catch {}
    }

    /**
     * @dev Gets the current available level based on experience
     * @param experience The character's experience points
     * @return currentAvailableLevel The level the character can reach
     */
    function UD__getCurrentAvailableLevel(uint256 experience) public view returns (uint256 currentAvailableLevel) {
        uint256[] memory levelsTable = new uint256[](MAX_LEVEL);
        for (uint256 i = 0; i < MAX_LEVEL; i++) {
            levelsTable[i] = Levels.get(i);
        }
        return StatCalculator.calculateLevelFromExperience(experience, levelsTable);
    }

    /**
     * @dev Checks if a character has completed any zone and records it
     * @param characterId The character to check
     * @param newLevel The level just attained
     */
    function _checkZoneCompletion(bytes32 characterId, uint256 newLevel) internal {
        // Check each configured zone (currently just Dark Cave)
        uint256[] memory zoneIds = new uint256[](1);
        zoneIds[0] = ZONE_DARK_CAVE;

        for (uint256 i = 0; i < zoneIds.length; i++) {
            uint256 zoneId = zoneIds[i];
            uint256 maxLevel = ZoneConfig.getMaxLevel(zoneId);
            if (maxLevel == 0) continue; // Zone not configured

            if (newLevel < maxLevel) continue;

            // Check if already completed
            if (CharacterZoneCompletion.getCompleted(characterId, zoneId)) continue;

            // Record completion
            bytes32[] memory completed = ZoneCompletions.getCompletedCharacters(zoneId);
            uint256 rank = completed.length + 1;

            ZoneCompletions.pushCompletedCharacters(zoneId, characterId);
            ZoneCompletions.pushCompletedTimestamps(zoneId, block.timestamp);

            CharacterZoneCompletion.set(characterId, zoneId, true, block.timestamp, rank);

            // Mint badge if within top N
            if (rank <= MAX_ZONE_CONQUEROR_BADGES) {
                _mintZoneConquerorBadge(characterId, zoneId);
            }
        }
    }

    /**
     * @dev Admin function to retroactively trigger zone completion for characters
     *      that reached max level before the zone completion system was deployed.
     *      Badge minting is wrapped in try/catch because the puppet callFrom delegation
     *      may not be configured. Badges can be minted separately by namespace owner.
     * @param characterId The character to backfill zone completion for
     */
    function backfillZoneCompletion(bytes32 characterId) public {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        if (!IWorld(_world()).UD__isValidCharacterId(characterId)) {
            revert LevelSystem_CharacterNotFound();
        }
        uint256 level = Stats.getLevel(characterId);
        _checkZoneCompletion(characterId, level);
    }

    /**
     * @dev Mints a Zone Conqueror badge to a character's owner
     * @param characterId The character that completed the zone
     * @param zoneId The zone that was completed
     */
    function _mintZoneConquerorBadge(bytes32 characterId, uint256 zoneId) internal {
        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 badgeBase = ZoneConfig.getBadgeBase(zoneId);
        uint256 badgeId = (badgeBase * 1_000_000) + tokenId;
        _mintBadgeDirect(owner, badgeId);
    }

    /**
     * @dev Mints a badge by writing directly to the Badges ERC721 tables.
     *      Bypasses the puppet's _requireOwner() check which blocks non-owner systems.
     *      LevelSystem has ResourceAccess to the Badges tables via EnsureAccess.
     */
    function _mintBadgeDirect(address to, uint256 badgeId) internal {
        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId balancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        // Revert if badge already exists
        address existing = ERC721Owners.get(ownersTableId, badgeId);
        require(existing == address(0), "Badge already minted");

        ERC721Owners.set(ownersTableId, badgeId, to);
        uint256 currentBalance = ERC721Balances.get(balancesTableId, to);
        ERC721Balances.set(balancesTableId, to, currentBalance + 1);
    }

    /**
     * @dev External wrapper for _mintBadgeDirect so it can be called via try/catch
     */
    function _mintBadgeExternal(address to, uint256 badgeId) external {
        _requireAccess(address(this), _msgSender());
        _mintBadgeDirect(to, badgeId);
    }

    /**
     * @dev Sets stats for an entity (internal function)
     * @param entityId The entity ID
     * @param adjustedStats Adjusted combat stats
     * @param level The character level
     */
    function _setStats(bytes32 entityId, AdjustedCombatStats memory adjustedStats, uint256 level) internal {
        _requireAccess(address(this), _msgSender());
        // Get existing stats to preserve certain fields
        StatsData memory existingStats = Stats.get(entityId);

        // Update combat-related fields while preserving class-related fields
        existingStats.strength = adjustedStats.strength;
        existingStats.agility = adjustedStats.agility;
        existingStats.intelligence = adjustedStats.intelligence;
        existingStats.maxHp = adjustedStats.maxHp;
        existingStats.currentHp = adjustedStats.maxHp;
        existingStats.level = level;

        Stats.set(entityId, existingStats);
    }

    /**
     * @dev Gets character class (helper function)
     * @param characterId The character ID
     * @return characterClass The character's class
     */
    function getClass(bytes32 characterId) internal view returns (Classes characterClass) {
        return Stats.getClass(characterId);
    }
}
