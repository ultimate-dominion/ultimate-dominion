// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterZone,
    CharacterZoneCompletion,
    EntitiesAtPosition,
    EncounterEntity,
    Position,
    SessionTimer,
    Spawned,
    Stats,
    ZoneConfig,
    ZoneMapConfig
} from "../codegen/index.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
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
import {ZONE_DARK_CAVE} from "../../constants.sol";

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
        (uint16 currentX, uint16 currentY) = Position.get(entityId);
        _removeFromPosition(entityId, currentX, currentY);

        // 2. Update zone
        CharacterZone.set(entityId, targetZoneId);

        // 3. Set position to target zone origin
        uint16 originX = ZoneMapConfig.getOriginX(targetZoneId);
        uint16 originY = ZoneMapConfig.getOriginY(targetZoneId);
        Position.set(entityId, originX, originY);
        EntitiesAtPosition.pushEntities(originX, originY, entityId);

        // 4. Reset move cooldown for immediate movement
        SessionTimer.set(entityId, 0);

        // 5. Spawn mobs on the origin tile
        IWorld(_world()).UD__spawnOnTileEnter(originX, originY);
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

    function _removeFromPosition(bytes32 entityId, uint16 x, uint16 y) internal {
        bytes32[] memory entities = EntitiesAtPosition.getEntities(x, y);
        for (uint256 i; i < entities.length; i++) {
            if (entities[i] == entityId) {
                bytes32 last = entities[entities.length - 1];
                EntitiesAtPosition.updateEntities(x, y, i, last);
                EntitiesAtPosition.popEntities(x, y);
                return;
            }
        }
    }
}
