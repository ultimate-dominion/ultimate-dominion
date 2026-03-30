// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CharacterZone,
    Counters,
    EntitiesAtPositionV2,
    CharacterEquipment,
    MapConfig,
    PositionV2,
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

        (uint256 zoneId, uint16 currentX, uint16 currentY) = PositionV2.get(entityId);

        // Zone-relative bounds checking
        uint16 zoneWidth = ZoneMapConfig.getWidth(zoneId);

        if (zoneWidth > 0) {
            uint16 zoneHeight = ZoneMapConfig.getHeight(zoneId);
            if (x >= zoneWidth) revert OutOfBounds();
            if (y >= zoneHeight) revert OutOfBounds();
        } else {
            // Fallback to global MapConfig (backward compat for unconfigured zones)
            (uint16 height, uint16 width) = MapConfig.get();
            if (x >= width) revert OutOfBounds();
            if (y >= height) revert OutOfBounds();
        }

        if (_standardDistance(currentX, currentY, x, y) != 1) revert InvalidMove();
        _moveEntity(entityId, zoneId, currentX, currentY, x, y);
        IWorld(_world()).UD__spawnOnTileEnter(zoneId, x, y);
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

        // Determine spawn zone — coordinates are always (0,0) zone-relative
        uint256 zoneId = isCharacter ? _getCharacterZone(entityId) : 0;

        PositionV2.set(entityId, zoneId, 0, 0);
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
        EntitiesAtPositionV2.pushEntities(zoneId, 0, 0, entityId);

        // Fragment I: The Awakening - triggers on first spawn
        if (isCharacter) {
            IWorld(_world()).UD__triggerFragment(entityId, 1, 0, 0);
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

    function getEntitiesAtPosition(uint256 zoneId, uint16 x, uint16 y) public view returns (bytes32[] memory entitiesAtPosition) {
        return EntitiesAtPositionV2.getEntities(zoneId, x, y);
    }

    function isAtPosition(bytes32 entityId, uint16 x, uint16 y) public view returns (bool _isAtPosition) {
        (, uint16 j, uint16 k) = PositionV2.get(entityId);
        if (j == x && k == y) {
            _isAtPosition = true;
        }
    }

    function getEntityPosition(bytes32 entityId) public view returns (uint256 zoneId, uint16 x, uint16 y) {
        (zoneId, x, y) = PositionV2.get(entityId);
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

    function _moveEntity(bytes32 entityId, uint256 zoneId, uint16 currentX, uint16 currentY, uint16 x, uint16 y) internal {
        bytes32[] memory entAtPos = EntitiesAtPositionV2.getEntities(zoneId, currentX, currentY);
        bool entityWasAtPosition;
        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                entityWasAtPosition = true;
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPositionV2.updateEntities(zoneId, currentX, currentY, i, lastEnt);
                EntitiesAtPositionV2.popEntities(zoneId, currentX, currentY);
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
        PositionV2.set(entityId, zoneId, x, y);
        EntitiesAtPositionV2.pushEntities(zoneId, x, y, entityId);
    }
}
