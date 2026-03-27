// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterZone,
    Counters,
    EntitiesAtPosition,
    CharacterEquipment,
    MapConfig,
    Position,
    Spawned,
    Stats,
    EncounterEntity,
    SessionTimer,
    UltimateDominionConfig,
    ZoneMapConfig
} from "../codegen/index.sol";
import {FRAGMENT_CENTER_X, FRAGMENT_CENTER_Y, MOVE_COOLDOWN, PLAYER_COUNTER_KEY, ZONE_DARK_CAVE, ZONE_WINDY_PEAKS} from "../../constants.sol";
import {FragmentProgress} from "@codegen/index.sol";
import {FragmentType, FragmentTriggerType} from "@codegen/common.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {OnlyCharacters, Unauthorized, NotSpawned, AlreadySpawned, InEncounter, OutOfBounds, InvalidMove, MaxPlayers, EntityNotAtPosition, MoveTooFast} from "../Errors.sol";
import {PauseLib} from "../libraries/PauseLib.sol";

contract MapSystem is System {
    /**
     * @notice Check if caller is owner or has unlimited delegation from owner
     * @param owner The character owner address
     * @return True if caller is owner or has valid delegation
     */
    function _isOwnerOrDelegated(address owner) internal view returns (bool) {
        if (_msgSender() == owner) {
            return true;
        }
        // Check if caller has any delegation from owner (unlimited or game delegation)
        ResourceId delegationId = UserDelegationControl.getDelegationControlId(owner, _msgSender());
        return ResourceId.unwrap(delegationId) != bytes32(0);
    }

    function move(bytes32 entityId, uint16 x, uint16 y) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(entityId);
        if (!IWorld(_world()).UD__isValidCharacterId(entityId)) revert OnlyCharacters();
        if (!_isOwnerOrDelegated(owner)) revert Unauthorized();
        if (!Spawned.getSpawned(entityId)) revert NotSpawned();
        if (EncounterEntity.getEncounterId(entityId) != bytes32(0)) revert InEncounter();
        uint256 lastAction = SessionTimer.get(entityId);
        if (lastAction != 0 && block.timestamp < lastAction + MOVE_COOLDOWN) revert MoveTooFast();

        (uint16 currentX, uint16 currentY) = Position.get(entityId);

        // Zone-aware bounds checking
        uint256 zoneId = _getCharacterZone(entityId);
        uint16 zoneWidth = ZoneMapConfig.getWidth(zoneId);

        if (zoneWidth > 0) {
            // Zone configured — validate within zone bounds
            uint16 originX = ZoneMapConfig.getOriginX(zoneId);
            uint16 originY = ZoneMapConfig.getOriginY(zoneId);
            uint16 zoneHeight = ZoneMapConfig.getHeight(zoneId);
            if (x < originX || x >= originX + zoneWidth) revert OutOfBounds();
            if (y < originY || y >= originY + zoneHeight) revert OutOfBounds();
        } else {
            // Fallback to global MapConfig (backward compat for unconfigured zones)
            (uint16 height, uint16 width) = MapConfig.get();
            if (x >= width) revert OutOfBounds();
            if (y >= height) revert OutOfBounds();
        }

        if (_standardDistance(currentX, currentY, x, y) != 1) revert InvalidMove();
        _moveEntity(entityId, currentX, currentY, x, y);
        IWorld(_world()).UD__spawnOnTileEnter(x, y);
    }

    function spawn(bytes32 entityId) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(entityId);
        if (!_isOwnerOrDelegated(owner)) revert Unauthorized();
        if (Spawned.getSpawned(entityId)) revert AlreadySpawned();
        int256 maxHp = Stats.getMaxHp(entityId);
        bool isCharacter = IWorld(_world()).UD__isValidCharacterId(entityId);

        // Only count player characters against maxPlayers cap (not mobs)
        uint256 spawnedPlayers = Counters.get(PLAYER_COUNTER_KEY, 0);
        if (isCharacter) {
            if (spawnedPlayers >= UltimateDominionConfig.getMaxPlayers()) revert MaxPlayers();
            int256 currentHp = maxHp + CharacterEquipment.getHpBonus(entityId);
            if (currentHp > 0) {
                Stats.setCurrentHp(entityId, currentHp);
            } else {
                Stats.setCurrentHp(entityId, 1);
            }
        } else {
            Stats.setCurrentHp(entityId, maxHp);
        }

        // Determine spawn position from character's zone
        uint16 homeX = 0;
        uint16 homeY = 0;
        if (isCharacter) {
            uint256 zoneId = _getCharacterZone(entityId);
            uint16 zoneWidth = ZoneMapConfig.getWidth(zoneId);
            if (zoneWidth > 0) {
                homeX = ZoneMapConfig.getOriginX(zoneId);
                homeY = ZoneMapConfig.getOriginY(zoneId);
            }
        }

        Position.set(entityId, homeX, homeY);
        Spawned.setSpawned(entityId, true);

        if (isCharacter) {
            // Allow immediate movement after spawn — pre-expire the cooldown
            SessionTimer.set(entityId, block.timestamp - MOVE_COOLDOWN);
            // re-calculate equipment bonuses
            IWorld(_world()).UD__setStats(entityId, IWorld(_world()).UD__calculateEquipmentBonuses(entityId));
            // increment player counter (only for characters)
            Counters.set(PLAYER_COUNTER_KEY, 0, (spawnedPlayers + 1));
        }
        // Clear stale encounter state — defensive reset in case a previous session's
        // encounter wasn't properly resolved (client crash, failed tx, etc.)
        EncounterEntity.setEncounterId(entityId, bytes32(0));
        EncounterEntity.setDied(entityId, false);
        EntitiesAtPosition.pushEntities(homeX, homeY, entityId);

        // Fragment I: The Awakening - triggers on first spawn
        if (isCharacter) {
            IWorld(_world()).UD__triggerFragment(entityId, 1, homeX, homeY);
        }
    }

    /// @notice Returns the number of spawned player characters (not mobs).
    function getSpawnedPlayerCount() public view returns (uint256) {
        return Counters.get(PLAYER_COUNTER_KEY, 0);
    }

    /// @notice Returns the player counter key used for spawn tracking.
    function getPlayerCounterKey() public pure returns (address) {
        return PLAYER_COUNTER_KEY;
    }

    function getEntitiesAtPosition(uint16 x, uint16 y) public view returns (bytes32[] memory entitiesAtPosition) {
        return EntitiesAtPosition.getEntities(x, y);
    }

    function isAtPosition(bytes32 entityId, uint16 x, uint16 y) public view returns (bool _isAtPosition) {
        (uint16 j, uint16 k) = Position.get(entityId);
        if (j == x && k == y) {
            _isAtPosition = true;
        }
    }

    function getEntityPosition(bytes32 entityId) public view returns (uint16 x, uint16 y) {
        (x, y) = Position.get(entityId);
    }

    function _getCharacterZone(bytes32 entityId) internal view returns (uint256) {
        uint256 zoneId = CharacterZone.getZoneId(entityId);
        return zoneId == 0 ? ZONE_DARK_CAVE : zoneId;
    }

    function _standardDistance(uint16 fromX, uint16 fromY, uint16 toX, uint16 toY) internal pure returns (uint16) {
        uint16 deltaX = fromX > toX ? fromX - toX : toX - fromX;
        uint16 deltaY = fromY > toY ? fromY - toY : toY - fromY;
        return deltaX + deltaY;
    }

    function _moveEntity(bytes32 entityId, uint16 currentX, uint16 currentY, uint16 x, uint16 y) internal {
        bytes32[] memory entAtPos = getEntitiesAtPosition(currentX, currentY);
        bool entityWasAtPosition;
        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                entityWasAtPosition = true;
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentY, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        if (!entityWasAtPosition) revert EntityNotAtPosition();
        // if character set session timer
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            SessionTimer.set(entityId, block.timestamp);

            // Fragment V: The Marrow - triggers when reaching center tile (5,5)
            if (x == FRAGMENT_CENTER_X && y == FRAGMENT_CENTER_Y) {
                if (!FragmentProgress.getClaimed(entityId, FragmentType.TheWound)) {
                    IWorld(_world()).UD__triggerFragment(entityId, 5, x, y);
                }
            }

            // Zone 2 chain-based tile triggers — try all Z2 chains on each move
            if (_getCharacterZone(entityId) == ZONE_WINDY_PEAKS) {
                bytes memory tileData = abi.encode(x, y);
                for (uint8 ft = 9; ft <= 16; ft++) {
                    IWorld(_world()).UD__tryAdvanceChain(
                        entityId, ft,
                        uint8(FragmentTriggerType.TileVisit),
                        tileData
                    );
                }
            }
        }
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }
}
