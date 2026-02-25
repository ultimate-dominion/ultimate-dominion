// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    FragmentProgress,
    FragmentMetadata,
    CharacterFirstActions,
    Characters,
    Admin
} from "@codegen/index.sol";
import {FragmentType} from "@codegen/common.sol";
import {Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {_ownersTableId, _balancesTableId} from "@latticexyz/world-modules/src/modules/erc721-puppet/utils.sol";
import {CRYSTAL_ELEMENTAL_MOB_ID, SHADOW_STALKER_MOB_ID, LICH_ACOLYTE_MOB_ID, FRAGMENTS_NAMESPACE} from "../../constants.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

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
        PauseLib.requireNotPaused();
        require(fragmentType >= 1 && fragmentType <= 8, "Invalid fragment type");
        require(_isCharacter(characterId), "Invalid character");

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
     * @notice Claim a triggered fragment and mint the NFT
     * @param characterId The character ID
     * @param fragmentType The fragment type (1-8)
     * @return tokenId The minted token ID
     */
    function claimFragment(bytes32 characterId, uint8 fragmentType) public returns (uint256 tokenId) {
        PauseLib.requireNotPaused();
        require(fragmentType >= 1 && fragmentType <= 8, "Invalid fragment type");
        require(_isCharacter(characterId), "Invalid character");

        address owner = Characters.getOwner(characterId);
        require(owner == _msgSender(), "Only character owner can claim");

        FragmentType fType = FragmentType(fragmentType);

        // Must be triggered but not claimed
        require(FragmentProgress.getTriggered(characterId, fType), "Fragment not triggered");
        require(!FragmentProgress.getClaimed(characterId, fType), "Fragment already claimed");

        // Calculate token ID: fragmentType * 1_000_000 + characterTokenId
        uint256 characterTokenId = Characters.getTokenId(characterId);
        tokenId = uint256(fragmentType) * 1_000_000 + characterTokenId;

        // Mint the NFT by writing directly to ERC721 tables.
        // Bypasses the puppet's callFrom flow which has access control issues
        // when called from within a system's delegatecall context.
        require(Owners.get(_ownersTableId(FRAGMENTS_NAMESPACE), tokenId) == address(0), "Token already minted");
        Owners.set(_ownersTableId(FRAGMENTS_NAMESPACE), tokenId, owner);
        uint256 currentBalance = Balances.get(_balancesTableId(FRAGMENTS_NAMESPACE), owner);
        Balances.set(_balancesTableId(FRAGMENTS_NAMESPACE), owner, currentBalance + 1);

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

    function checkCombatFragmentTriggersForGroup(
        bytes32[] memory winners,
        bytes32[] memory defeated,
        uint16 tileX,
        uint16 tileY,
        bool defeatedAreMobs
    ) public {
        for (uint256 i = 0; i < winners.length; i++) {
            if (_isCharacter(winners[i])) {
                checkCombatFragmentTriggers(winners[i], defeated, tileX, tileY, defeatedAreMobs);
            }
        }
    }

    function checkCombatFragmentTriggers(
        bytes32 characterId,
        bytes32[] memory defeated,
        uint16 tileX,
        uint16 tileY,
        bool defeatedAreMobs
    ) public {
        // Fragment III: The Restless - first monster kill
        if (defeatedAreMobs && !CharacterFirstActions.getHasKilledMonster(characterId)) {
            CharacterFirstActions.setHasKilledMonster(characterId, true);
            _triggerFragment(characterId, 3, tileX, tileY);
        }

        for (uint256 i = 0; i < defeated.length; i++) {
            bytes32 defeatedId = defeated[i];

            if (defeatedAreMobs) {
                // Inline getMobId: upper 32 bits of entityId encode the mob template ID
                uint256 mobId = uint256(uint256(defeatedId) >> 224);

                // Fragment IV: Souls That Linger - kill Crystal Elemental
                if (mobId == CRYSTAL_ELEMENTAL_MOB_ID) {
                    _triggerFragment(characterId, 4, tileX, tileY);
                }
                // Fragment VI: Death of the Death God - kill Lich Acolyte
                else if (mobId == LICH_ACOLYTE_MOB_ID) {
                    _triggerFragment(characterId, 6, tileX, tileY);
                }
                // Fragment VII: Betrayer's Truth - kill Shadow Stalker
                else if (mobId == SHADOW_STALKER_MOB_ID) {
                    _triggerFragment(characterId, 7, tileX, tileY);
                }
            } else {
                // PvP kill
                if (_isCharacter(defeatedId)) {
                    if (!CharacterFirstActions.getHasKilledPlayer(characterId)) {
                        CharacterFirstActions.setHasKilledPlayer(characterId, true);
                        _triggerFragment(characterId, 8, tileX, tileY);
                    }
                }
            }
        }
    }
}
