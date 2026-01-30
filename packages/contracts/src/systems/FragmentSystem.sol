// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    FragmentProgress,
    FragmentMetadata,
    CharacterFirstActions,
    Characters,
    UltimateDominionConfig,
    Admin
} from "@codegen/index.sol";
import {FragmentType} from "@codegen/common.sol";
import {IERC721Mintable} from "@latticexyz/world-modules/src/modules/erc721-puppet/IERC721Mintable.sol";

/**
 * @title FragmentSystem
 * @notice Manages the "Fragments of the Fallen" lore NFT collection
 * @dev Each fragment is triggered by in-game actions and can be claimed as an NFT
 */
contract FragmentSystem is System {
    // Events
    event FragmentTriggered(bytes32 indexed characterId, uint8 fragmentType, uint16 tileX, uint16 tileY);
    event FragmentClaimed(bytes32 indexed characterId, uint8 fragmentType, uint256 tokenId);

    /**
     * @notice Trigger a fragment for a character
     * @dev Called by other systems when trigger conditions are met
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-8)
     * @param tileX The X coordinate where triggered
     * @param tileY The Y coordinate where triggered
     */
    function triggerFragment(bytes32 characterId, uint8 fragmentType, uint16 tileX, uint16 tileY) public {
        require(fragmentType >= 1 && fragmentType <= 8, "Invalid fragment type");
        require(IWorld(_world()).UD__isValidCharacterId(characterId), "Invalid character");

        FragmentType fType = FragmentType(fragmentType);

        // Check if already triggered
        if (FragmentProgress.getTriggered(characterId, fType)) {
            return; // Already triggered, no-op
        }

        // Set triggered state
        FragmentProgress.setTriggered(characterId, fType, true);
        FragmentProgress.setTriggeredAt(characterId, fType, block.timestamp);
        FragmentProgress.setTriggerTileX(characterId, fType, tileX);
        FragmentProgress.setTriggerTileY(characterId, fType, tileY);

        emit FragmentTriggered(characterId, fragmentType, tileX, tileY);
    }

    /**
     * @notice Claim a triggered fragment and mint the NFT
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-8)
     * @return tokenId The minted token ID
     */
    function claimFragment(bytes32 characterId, uint8 fragmentType) public returns (uint256 tokenId) {
        require(fragmentType >= 1 && fragmentType <= 8, "Invalid fragment type");
        require(IWorld(_world()).UD__isValidCharacterId(characterId), "Invalid character");

        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Only character owner can claim");

        FragmentType fType = FragmentType(fragmentType);

        // Must be triggered but not claimed
        require(FragmentProgress.getTriggered(characterId, fType), "Fragment not triggered");
        require(!FragmentProgress.getClaimed(characterId, fType), "Fragment already claimed");

        // Calculate token ID: fragmentType * 1_000_000 + characterTokenId
        uint256 characterTokenId = Characters.getTokenId(characterId);
        tokenId = uint256(fragmentType) * 1_000_000 + characterTokenId;

        // Mint the NFT
        address fragmentToken = UltimateDominionConfig.getFragmentToken();
        require(fragmentToken != address(0), "Fragment token not configured");
        IERC721Mintable(fragmentToken).mint(owner, tokenId);

        // Update claimed state
        FragmentProgress.setClaimed(characterId, fType, true);
        FragmentProgress.setClaimedAt(characterId, fType, block.timestamp);
        FragmentProgress.setTokenId(characterId, fType, tokenId);

        emit FragmentClaimed(characterId, fragmentType, tokenId);

        return tokenId;
    }

    /**
     * @notice Check if a fragment can be claimed
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-8)
     * @return True if the fragment is triggered but not claimed
     */
    function canClaim(bytes32 characterId, uint8 fragmentType) public view returns (bool) {
        if (fragmentType < 1 || fragmentType > 8) return false;

        FragmentType fType = FragmentType(fragmentType);
        return FragmentProgress.getTriggered(characterId, fType) &&
               !FragmentProgress.getClaimed(characterId, fType);
    }

    /**
     * @notice Get the status of a specific fragment for a character
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-8)
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
        if (fragmentType < 1 || fragmentType > 8) {
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
     * @param fragmentType The fragment type (1-8)
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
        require(Admin.getIsAdmin(_msgSender()), "Only admin can set metadata");
        require(fragmentType >= 1 && fragmentType <= 8, "Invalid fragment type");

        FragmentType fType = FragmentType(fragmentType);
        FragmentMetadata.setName(fType, name);
        FragmentMetadata.setNarrative(fType, narrative);
        FragmentMetadata.setHint(fType, hint);
    }

    /**
     * @notice Get fragment metadata
     * @param fragmentType The fragment type (1-8)
     * @return name The fragment name
     * @return narrative The fragment narrative text
     * @return hint The hint for discovery
     */
    function getFragmentMetadata(uint8 fragmentType) public view returns (
        string memory name,
        string memory narrative,
        string memory hint
    ) {
        if (fragmentType < 1 || fragmentType > 8) {
            return ("", "", "");
        }

        FragmentType fType = FragmentType(fragmentType);
        name = FragmentMetadata.getName(fType);
        narrative = FragmentMetadata.getNarrative(fType);
        hint = FragmentMetadata.getHint(fType);
    }
}
