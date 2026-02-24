// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CombatEncounter,
    Counters,
    EntitiesAtPosition,
    CharacterEquipment,
    CombatEncounterData,
    CombatEncounter,
    CombatOutcome,
    MapConfig,
    Position,
    Spawned,
    Stats,
    EncounterEntity,
    SessionTimer,
    UltimateDominionConfig
} from "../codegen/index.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {SESSION_TIMEOUT, FRAGMENT_CENTER_X, FRAGMENT_CENTER_Y, MOVE_COOLDOWN} from "../../constants.sol";
import {FragmentProgress} from "@codegen/index.sol";
import {FragmentType} from "@codegen/common.sol";
import {_requireAccess} from "../utils.sol";
import {UserDelegationControl} from "@latticexyz/world/src/codegen/tables/UserDelegationControl.sol";
import {UNLIMITED_DELEGATION} from "@latticexyz/world/src/constants.sol";
import {OnlyCharacters, Unauthorized, NotSpawned, AlreadySpawned, InEncounter, OutOfBounds, InvalidMove, MaxPlayers, EntityNotAtPosition, UseFleeFunction, SessionNotTimedOut, MoveTooFast} from "../Errors.sol";
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
        // Check if caller has unlimited delegation from owner
        ResourceId delegationId = UserDelegationControl.getDelegationControlId(owner, _msgSender());
        return ResourceId.unwrap(delegationId) == ResourceId.unwrap(UNLIMITED_DELEGATION);
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
        (uint16 height, uint16 width) = MapConfig.get();

        if (x >= width) revert OutOfBounds();
        if (y >= height) revert OutOfBounds();
        if (_standardDistance(currentX, currentY, x, y) != 1) revert InvalidMove();
        _moveEntity(entityId, currentX, currentY, x, y);
        IWorld(_world()).UD__spawnOnTileEnter(x, y);
    }

    function spawn(bytes32 entityId) public {
        PauseLib.requireNotPaused();
        address owner = Characters.getOwner(entityId);
        if (!_isOwnerOrDelegated(owner)) revert Unauthorized();
        uint256 spawnedPlayers = Counters.get(address(this), 0);
        if (spawnedPlayers > UltimateDominionConfig.getMaxPlayers()) revert MaxPlayers();
        if (Spawned.getSpawned(entityId)) revert AlreadySpawned();
        int256 maxHp = Stats.getMaxHp(entityId);
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            int256 currentHp = maxHp + CharacterEquipment.getHpBonus(entityId);
            if (currentHp > 0) {
                Stats.setCurrentHp(entityId, currentHp);
            } else {
                Stats.setCurrentHp(entityId, 1);
            }
        } else {
            Stats.setCurrentHp(entityId, maxHp);
        }

        // set character position to home point
        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, true);

        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            SessionTimer.set(entityId, block.timestamp);
            // re-calculate equipment bonuses
            IWorld(_world()).UD__setStats(entityId, IWorld(_world()).UD__calculateEquipmentBonuses(entityId));
        }
        EncounterEntity.setDied(entityId, false);
        EntitiesAtPosition.pushEntities(0, 0, entityId);
        // add 1 to spawned players
        Counters.set(address(this), 0, (spawnedPlayers + 1));

        // Fragment I: The Awakening - triggers on first spawn
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            IWorld(_world()).UD__triggerFragment(entityId, 1, 0, 0);
        }
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

    function _standardDistance(uint16 fromX, uint16 fromY, uint16 toX, uint16 toY) internal pure returns (uint16) {
        uint16 deltaX = fromX > toX ? fromX - toX : toX - fromX;
        uint16 deltaY = fromY > toY ? fromY - toY : toY - fromY;
        return deltaX + deltaY;
    }

    function removeEntityFromBoard(bytes32 entityId) public {
        PauseLib.requireNotPaused();
        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);

        // if entity is a character
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            uint256 spawnedPlayers = Counters.get(address(this), 0);
            bool senderIsOwner = IWorld(_world()).UD__isValidOwner(entityId, _msgSender());
            // if sender is owner
            if (senderIsOwner) {
                // if character is in combat use the combat flee function
                if (encounterId != bytes32(0)) revert UseFleeFunction();
                Counters.set(address(this), 0, (spawnedPlayers - 1));
                // if caller is not a system
            } else if (bytes32(abi.encode(SystemRegistry.getSystemId(_msgSender()))) == bytes32(0)) {
                if ((SessionTimer.get(entityId) + SESSION_TIMEOUT) >= block.timestamp) revert SessionNotTimedOut();
                Counters.set(address(this), 0, (spawnedPlayers - 1));
                // Note: Access check removed to allow inter-system calls
            } else {
                // Inter-system call (e.g., from EncounterSystem)
                Counters.set(address(this), 0, (spawnedPlayers - 1));
            }
        } else {
            // Non-character entity (e.g., monster) - allow inter-system calls
        }

        (uint16 currentX, uint16 currentY) = getEntityPosition(entityId);
        bytes32[] memory entAtPos = getEntitiesAtPosition(currentX, currentY);

        for (uint256 i; i < entAtPos.length;) {
            if (entAtPos[i] == entityId) {
                bytes32 lastEnt = entAtPos[entAtPos.length - 1];
                EntitiesAtPosition.updateEntities(currentX, currentY, i, lastEnt);
                EntitiesAtPosition.popEntities(currentX, currentY);
                break;
            }
            {
                i++;
            }
        }
        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, false);

        bytes32[] memory emptyArray;

        // end combat for entity
        if (encounterId != bytes32(0)) {
            CombatEncounterData memory encounterData = CombatEncounter.get(encounterId);
            for (uint256 i; i < encounterData.attackers.length; i++) {
                EncounterEntity.setEncounterId(encounterData.attackers[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.attackers[i], emptyArray);
            }
            for (uint256 i; i < encounterData.defenders.length; i++) {
                EncounterEntity.setEncounterId(encounterData.defenders[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(encounterData.defenders[i], emptyArray);
            }

            EncounterEntity.setDied(entityId, true);
            CombatEncounter.setEnd(encounterId, block.timestamp);
        }
    }

    function removeEntitiesFromBoard(bytes32[] memory entityIds) public {
        for (uint256 i; i < entityIds.length; i++) {
            removeEntityFromBoard(entityIds[i]);
        }
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

            // Fragment V: The Wound - triggers when reaching center tile (5,5)
            if (x == FRAGMENT_CENTER_X && y == FRAGMENT_CENTER_Y) {
                if (!FragmentProgress.getClaimed(entityId, FragmentType.TheWound)) {
                    IWorld(_world()).UD__triggerFragment(entityId, 5, x, y);
                }
            }
        }
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }
}
