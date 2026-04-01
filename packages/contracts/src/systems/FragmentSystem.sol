// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    FragmentProgress,
    FragmentMetadata,
    Characters,
    Admin,
    Stats,
    StatsData,
    UltimateDominionConfig
} from "@codegen/index.sol";
import {FragmentType} from "@codegen/common.sol";
import {Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_ownersTableId, _balancesTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {FRAGMENTS_NAMESPACE, BADGES_NAMESPACE, ZONE_DARK_CAVE, ZONE_WINDY_PEAKS, BADGE_ZONE_FRAGMENT_BASE, FRAGMENT_XP_REWARD} from "../../constants.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {_requireSystemOrAdmin, _isSystemOrAdmin} from "../utils.sol";

/**
 * @title FragmentSystem
 * @notice Manages the "Fragments" lore NFT collection
 * @dev Each fragment is triggered by in-game actions and can be claimed as an NFT
 */
contract FragmentSystem is System {
    error InvalidFragmentType();
    error InvalidCharacter();
    error NotCharacterOwner();
    error FragmentNotTriggered();
    error FragmentAlreadyClaimed();
    error TokenAlreadyMinted();
    error NotAdmin();

    event FragmentTriggered(bytes32 indexed characterId, uint8 fragmentType, uint16 tileX, uint16 tileY);
    event FragmentClaimed(bytes32 indexed characterId, uint8 fragmentType, uint256 tokenId);

    /**
     * @notice Trigger a fragment for a character
     * @dev Called by other systems when trigger conditions are met
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-16)
     * @param tileX The X coordinate where triggered
     * @param tileY The Y coordinate where triggered
     */
    function triggerFragment(bytes32 characterId, uint8 fragmentType, uint16 tileX, uint16 tileY) public {
        // Allow character owner (client call) OR game systems (inter-system call)
        address sender = _msgSender();
        if (Characters.getOwner(characterId) != sender && !_isSystemOrAdmin(sender)) revert NotCharacterOwner();
        PauseLib.requireNotPaused();
        if (fragmentType < 1 || fragmentType > 16) revert InvalidFragmentType();
        if (!_isCharacter(characterId)) revert InvalidCharacter();

        _triggerFragment(characterId, fragmentType, tileX, tileY);
    }

    function _triggerFragment(bytes32 characterId, uint8 fragmentType, uint16 tileX, uint16 tileY) private {
        FragmentType fType = FragmentType(fragmentType);

        // Check if already triggered
        if (FragmentProgress.getTriggered(characterId, fType)) {
            return; // Already triggered, no-op
        }

        // Batch all fields into a single setRecord call to minimize external CALL overhead.
        // 4 separate setStaticField calls each cost ~32K gas (external CALL to World);
        // 1 setRecord call writes everything in one round-trip.
        FragmentProgress.set(characterId, fType, true, block.timestamp, tileX, tileY, false, 0, 0);

        emit FragmentTriggered(characterId, fragmentType, tileX, tileY);
    }

    function _isCharacter(bytes32 entityId) private view returns (bool) {
        return Characters.getOwner(entityId) != address(0);
    }

    /**
     * @dev Check if all zone fragments are claimed and mint zone fragment badge
     * @param characterId The character to check
     * @param zoneId The zone ID for the badge
     * @param startType First fragment type in zone (inclusive)
     * @param endType Last fragment type in zone (inclusive)
     */
    function _checkZoneFragmentBadge(bytes32 characterId, uint256 zoneId, uint8 startType, uint8 endType) private {
        for (uint8 i = startType; i <= endType; i++) {
            if (!FragmentProgress.getClaimed(characterId, FragmentType(i))) return;
        }
        address badgeToken = UltimateDominionConfig.getBadgeToken();
        if (badgeToken == address(0)) return;
        address owner = Characters.getOwner(characterId);
        uint256 tokenId = Characters.getTokenId(characterId);
        uint256 badgeBase = BADGE_ZONE_FRAGMENT_BASE + zoneId;
        uint256 badgeId = (badgeBase * 1_000_000) + tokenId;
        if (Owners.get(_ownersTableId(BADGES_NAMESPACE), badgeId) != address(0)) return;
        Owners.set(_ownersTableId(BADGES_NAMESPACE), badgeId, owner);
        uint256 bal = Balances.get(_balancesTableId(BADGES_NAMESPACE), owner);
        Balances.set(_balancesTableId(BADGES_NAMESPACE), owner, bal + 1);
    }

    /**
     * @notice Claim a triggered fragment and mint the NFT
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-16)
     * @return tokenId The minted token ID
     */
    function claimFragment(bytes32 characterId, uint8 fragmentType) public returns (uint256 tokenId) {
        PauseLib.requireNotPaused();
        if (fragmentType < 1 || fragmentType > 16) revert InvalidFragmentType();
        if (!_isCharacter(characterId)) revert InvalidCharacter();

        address owner = Characters.getOwner(characterId);
        if (owner != _msgSender()) revert NotCharacterOwner();

        FragmentType fType = FragmentType(fragmentType);

        // Must be triggered but not claimed
        if (!FragmentProgress.getTriggered(characterId, fType)) revert FragmentNotTriggered();
        if (FragmentProgress.getClaimed(characterId, fType)) revert FragmentAlreadyClaimed();

        // Calculate token ID: fragmentType * 1_000_000 + characterTokenId
        uint256 characterTokenId = Characters.getTokenId(characterId);
        tokenId = uint256(fragmentType) * 1_000_000 + characterTokenId;

        // Mint the NFT by writing directly to ERC721 tables.
        if (Owners.get(_ownersTableId(FRAGMENTS_NAMESPACE), tokenId) != address(0)) revert TokenAlreadyMinted();
        Owners.set(_ownersTableId(FRAGMENTS_NAMESPACE), tokenId, owner);
        uint256 currentBalance = Balances.get(_balancesTableId(FRAGMENTS_NAMESPACE), owner);
        Balances.set(_balancesTableId(FRAGMENTS_NAMESPACE), owner, currentBalance + 1);

        // Update claimed state
        FragmentProgress.setClaimed(characterId, fType, true);
        FragmentProgress.setClaimedAt(characterId, fType, block.timestamp);
        FragmentProgress.setTokenId(characterId, fType, tokenId);

        // Award XP
        StatsData memory stats = Stats.get(characterId);
        stats.experience += FRAGMENT_XP_REWARD;
        Stats.set(characterId, stats);

        // Check zone completion → mint zone fragment badge
        if (fragmentType <= 8) {
            _checkZoneFragmentBadge(characterId, ZONE_DARK_CAVE, 1, 8);
        } else if (fragmentType <= 16) {
            _checkZoneFragmentBadge(characterId, ZONE_WINDY_PEAKS, 9, 16);
        }

        emit FragmentClaimed(characterId, fragmentType, tokenId);

        return tokenId;
    }

    /**
     * @notice Check if a fragment can be claimed
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-16)
     * @return True if the fragment is triggered but not claimed
     */
    function canClaim(bytes32 characterId, uint8 fragmentType) public view returns (bool) {
        if (fragmentType < 1 || fragmentType > 16) return false;

        FragmentType fType = FragmentType(fragmentType);
        return FragmentProgress.getTriggered(characterId, fType) &&
               !FragmentProgress.getClaimed(characterId, fType);
    }

    /**
     * @notice Get the status of a specific fragment for a character
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-16)
     * @return triggered Whether the fragment has been triggered
     * @return triggeredAt Timestamp when triggered (0 if not triggered)
     * @return triggerTileX X coordinate where triggered
     * @return triggerTileY Y coordinate where triggered
     * @return claimed Whether the fragment has been claimed
     * @return claimedAt Timestamp when claimed (0 if not claimed)
     * @return tokenId The token ID (0 if not claimed)
     */
    function getFragmentStatus(bytes32 characterId, uint8 fragmentType) public view returns (
        bool triggered,
        uint256 triggeredAt,
        uint16 triggerTileX,
        uint16 triggerTileY,
        bool claimed,
        uint256 claimedAt,
        uint256 tokenId
    ) {
        if (fragmentType < 1 || fragmentType > 16) {
            return (false, 0, 0, 0, false, 0, 0);
        }

        FragmentType fType = FragmentType(fragmentType);
        triggered = FragmentProgress.getTriggered(characterId, fType);
        triggeredAt = FragmentProgress.getTriggeredAt(characterId, fType);
        triggerTileX = FragmentProgress.getTriggerTileX(characterId, fType);
        triggerTileY = FragmentProgress.getTriggerTileY(characterId, fType);
        claimed = FragmentProgress.getClaimed(characterId, fType);
        claimedAt = FragmentProgress.getClaimedAt(characterId, fType);
        tokenId = FragmentProgress.getTokenId(characterId, fType);
    }

    /**
     * @notice Admin function to set fragment metadata
     * @param fragmentType The fragment type (1-16)
     * @param name The fragment name
     * @param narrative The fragment narrative text
     * @param hint The hint for how to discover this fragment
     */
    function setFragmentMetadata(
        uint8 fragmentType,
        string memory name,
        string memory narrative,
        string memory hint
    ) public {
        if (!Admin.getIsAdmin(_msgSender())) revert NotAdmin();
        if (fragmentType < 1 || fragmentType > 16) revert InvalidFragmentType();

        FragmentType fType = FragmentType(fragmentType);
        FragmentMetadata.setName(fType, name);
        FragmentMetadata.setNarrative(fType, narrative);
        FragmentMetadata.setHint(fType, hint);
    }

    /**
     * @notice Get fragment metadata
     * @param fragmentType The fragment type (1-16)
     * @return name The fragment name
     * @return narrative The fragment narrative text
     * @return hint The hint for discovery
     */
    function getFragmentMetadata(uint8 fragmentType) public view returns (
        string memory name,
        string memory narrative,
        string memory hint
    ) {
        if (fragmentType < 1 || fragmentType > 16) {
            return ("", "", "");
        }

        FragmentType fType = FragmentType(fragmentType);
        name = FragmentMetadata.getName(fType);
        narrative = FragmentMetadata.getNarrative(fType);
        hint = FragmentMetadata.getHint(fType);
    }

}
