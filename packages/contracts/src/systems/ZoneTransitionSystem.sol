// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterZone,
    CharacterZoneCompletion,
    EntitiesAtPositionV2,
    EncounterEntity,
    PositionV2,
    SessionTimer,
    Spawned,
    Stats,
    ZoneConfig,
    ZoneMapConfig
} from "../codegen/index.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {Owners as ERC721Owners} from "@latticexyz/world-modules/src/modules/erc721-puppet/tables/Owners.sol";
import {Balances as ERC721Balances} from "@latticexyz/world-modules/src/modules/tokens/tables/Balances.sol";
import {WorldResourceIdLib} from "@latticexyz/world/src/WorldResourceId.sol";
import {RESOURCE_TABLE} from "@latticexyz/store/src/storeResourceTypes.sol";
import {PauseLib} from "../libraries/PauseLib.sol";
import {
    AlreadyInZone,
    InEncounter,
    NotSpawned,
    OnlyCharacters,
    PrerequisiteZoneIncomplete,
    Unauthorized,
    ZoneLevelTooLow,
    ZoneNotConfigured
} from "../Errors.sol";
import {FragmentTriggerType} from "@codegen/common.sol";
import {ZONE_DARK_CAVE, ZONE_WINDY_PEAKS, BADGES_NAMESPACE, BADGE_ZONE_PIONEER_BASE} from "../../constants.sol";

contract ZoneTransitionSystem is System {
    /// @notice Transition a character to a different zone.
    /// @param entityId The character's entity ID.
    /// @param targetZoneId The zone to transition into.
    function transitionZone(bytes32 entityId, uint256 targetZoneId) public {
        PauseLib.requireNotPaused();

        // --- Access control ---
        if (!IWorld(_world()).UD__isValidCharacterId(entityId)) revert OnlyCharacters();
        address owner = Characters.getOwner(entityId);
        if (!_isOwnerOrDelegated(owner)) revert Unauthorized();
        if (!Spawned.getSpawned(entityId)) revert NotSpawned();
        if (EncounterEntity.getEncounterId(entityId) != bytes32(0)) revert InEncounter();

        // --- Zone validation ---
        // Target zone must be configured
        uint16 targetWidth = ZoneMapConfig.getWidth(targetZoneId);
        if (targetWidth == 0) revert ZoneNotConfigured();

        // Character must meet the zone's minimum level
        uint256 minLevel = ZoneMapConfig.getMinLevel(targetZoneId);
        uint256 charLevel = Stats.getLevel(entityId);
        if (charLevel < minLevel) revert ZoneLevelTooLow();

        // Must not already be in target zone
        uint256 currentZoneId = _getCharacterZone(entityId);
        if (currentZoneId == targetZoneId) revert AlreadyInZone();

        // --- Prerequisite check ---
        // For zones beyond Dark Cave, require completion of the previous zone.
        // Zone 1 (Dark Cave) has no prerequisites.
        // Zone N requires zone N-1 completion.
        // Future: could read dependencies from a config table for non-linear graphs.
        if (targetZoneId > ZONE_DARK_CAVE) {
            uint256 prereqZoneId = targetZoneId - 1;
            if (!CharacterZoneCompletion.getCompleted(entityId, prereqZoneId)) {
                revert PrerequisiteZoneIncomplete();
            }
        }

        // --- Execute transition ---
        // 1. Remove from current tile
        uint16 currentX; uint16 currentY;
        (, currentX, currentY) = PositionV2.get(entityId);
        _removeFromPosition(entityId, currentZoneId, currentX, currentY);

        // 2. Update zone
        CharacterZone.set(entityId, targetZoneId);

        // 3. Set position to zone-relative origin (0,0)
        PositionV2.set(entityId, targetZoneId, 0, 0);
        EntitiesAtPositionV2.pushEntities(targetZoneId, 0, 0, entityId);

        // 4. Reset move cooldown for immediate movement
        SessionTimer.set(entityId, 0);

        // 5. Spawn mobs on the origin tile
        IWorld(_world()).UD__spawnOnTileEnter(targetZoneId, 0, 0);

        // 6. Mint Pioneer badge (first entry into this zone)
        _tryMintPioneerBadge(entityId, targetZoneId);

        // 7. Initialize fragment chains for the target zone
        if (targetZoneId == ZONE_WINDY_PEAKS) {
            _initializeZ2Chains(entityId, 0, 0);
        }
    }

    /// @dev Initialize all 8 Z2 fragment chains and auto-complete Fragment IX (arrival).
    function _initializeZ2Chains(bytes32 entityId, uint16 originX, uint16 originY) internal {
        // Fragment type → total steps: IX=1, X=2, XI=2, XII=3, XIII=3, XIV=2, XV=3, XVI=3
        uint8[8] memory fragTypes = [uint8(9), 10, 11, 12, 13, 14, 15, 16];
        uint256[8] memory stepCounts = [uint256(1), 2, 2, 3, 3, 2, 3, 3];

        for (uint256 i; i < 8; i++) {
            IWorld(_world()).UD__initializeCharacterChain(entityId, fragTypes[i], stepCounts[i]);
        }

        // Fragment IX auto-triggers on arrival (1-step TileVisit at zone spawn)
        IWorld(_world()).UD__tryAdvanceChain(
            entityId, 9,
            uint8(FragmentTriggerType.TileVisit),
            abi.encode(originX, originY)
        );
    }

    /// @notice Get a character's current zone (0 or unset → Dark Cave).
    function getCharacterZone(bytes32 entityId) public view returns (uint256) {
        return _getCharacterZone(entityId);
    }

    // ─── Internal ────────────────────────────────────────────────

    function _getCharacterZone(bytes32 entityId) internal view returns (uint256) {
        uint256 zoneId = CharacterZone.getZoneId(entityId);
        // Unset (0) defaults to Dark Cave
        return zoneId == 0 ? ZONE_DARK_CAVE : zoneId;
    }

    function _isOwnerOrDelegated(address owner) internal view returns (bool) {
        if (_msgSender() == owner) return true;
        ResourceId delegationId = UserDelegationControl.getDelegationControlId(owner, _msgSender());
        return ResourceId.unwrap(delegationId) != bytes32(0);
    }

    function _tryMintPioneerBadge(bytes32 entityId, uint256 zoneId) internal {
        address owner = Characters.getOwner(entityId);
        uint256 tokenId = Characters.getTokenId(entityId);
        uint256 badgeId = (BADGE_ZONE_PIONEER_BASE + zoneId) * 1_000_000 + tokenId;

        ResourceId ownersTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Owners");
        ResourceId balancesTableId = WorldResourceIdLib.encode(RESOURCE_TABLE, BADGES_NAMESPACE, "Balances");

        // Skip if already minted (re-entry into zone)
        if (ERC721Owners.get(ownersTableId, badgeId) != address(0)) return;

        ERC721Owners.set(ownersTableId, badgeId, owner);
        uint256 currentBalance = ERC721Balances.get(balancesTableId, owner);
        ERC721Balances.set(balancesTableId, owner, currentBalance + 1);
    }

    function _removeFromPosition(bytes32 entityId, uint256 zoneId, uint16 x, uint16 y) internal {
        bytes32[] memory entities = EntitiesAtPositionV2.getEntities(zoneId, x, y);
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] == entityId) {
                bytes32 last = entities[entities.length - 1];
                EntitiesAtPositionV2.updateEntities(zoneId, x, y, i, last);
                EntitiesAtPositionV2.popEntities(zoneId, x, y);
                return;
            }
        }
    }
}
