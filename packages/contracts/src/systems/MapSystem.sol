// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {IWorld} from "@world/IWorld.sol";
import {
    Characters,
    CombatEncounter,
    EntitiesAtPosition,
    CharacterEquipment,
    MapConfig,
    Position,
    Spawned,
    Stats,
    MobsByLevel,
    EncounterEntity,
    SessionTimer
} from "../codegen/index.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import {IMobSystem} from "@world/IWorld.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {SESSION_TIMEOUT} from "../../constants.sol";
import {_requireAccess} from "../utils.sol";
import "forge-std/console.sol";

contract MapSystem is System {
    using LibChunks for uint256;

    function move(bytes32 entityId, uint16 x, uint16 y) public {
        address owner = Characters.getOwner(entityId);
        require(IWorld(_world()).UD__isValidCharacterId(entityId), "Can Only move characters");
        require(_msgSender() == owner, "Only the owner can move a character");
        require(Spawned.getSpawned(entityId), "Character not spawned");
        require(EncounterEntity.getEncounterId(entityId) == bytes32(0), "Cannot move while in an encounter.");

        (uint16 currentX, uint16 currentY) = Position.get(entityId);
        (uint16 height, uint16 width) = MapConfig.get();

        require(x < width, "X out of bounds");
        require(y < height, "Y out of bounds");
        require(_standardDistance(currentX, currentY, x, y) == 1, "Can only move 1 tile at a time");
        _moveEntity(entityId, currentX, currentY, x, y);
        _spawnOnTileEnter(x, y);
    }

    function spawn(bytes32 entityId) public {
        address owner = Characters.getOwner(entityId);
        require(_msgSender() == owner, "Only the owner can spawn a character");

        require(!Spawned.getSpawned(entityId), "Character already spawned");
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
        }
        EncounterEntity.setDied(entityId, false);
        EntitiesAtPosition.pushEntities(0, 0, entityId);
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

    function _spawnOnTileEnter(uint16 x, uint16 y) internal {
        uint256 distanceFromHome = uint256(_chebyshevDistance(0, 0, x, y));
        if (distanceFromHome == 0) {
            return;
        }

        uint8 startLevel = 0;
        uint8 endLevel = 0;

        if (distanceFromHome < 5) {
            startLevel = 1;
            endLevel = 6;
        } else {
            startLevel = 6;
            endLevel = 11;
        }

        uint256 numOfMobs = 0;
        for (uint256 i = startLevel; i < endLevel; i++) {
            numOfMobs += MobsByLevel.lengthMobIds(i);
        }

        uint256[] memory availableMonsters = new uint256[](numOfMobs);
        uint256 index = 0;

        for (uint256 i = startLevel; i < endLevel; i++) {
            uint256[] memory mobIds = MobsByLevel.getMobIds(i);
            for (uint256 j = 0; j < mobIds.length; j++) {
                availableMonsters[index] = mobIds[j];
                index++;
            }
        }

        require(availableMonsters.length > 0, "No monsters available for this distance");

        uint32[] memory rng;
        // TODO for testing, remove for deployment
        if (block.chainid == 31337) {
            rng = LibChunks.get8Chunks(block.timestamp ** 8);
        } else {
            rng = LibChunks.get8Chunks(block.prevrandao);
        }

        for (uint256 i; i < (rng[0] % 6); i++) {
            SystemSwitch.call(
                abi.encodeCall(
                    IMobSystem.UD__spawnMob, (availableMonsters[uint256(rng[i] % availableMonsters.length)], x, y)
                )
            );
        }
    }

    function _standardDistance(uint16 fromX, uint16 fromY, uint16 toX, uint16 toY) internal pure returns (uint16) {
        uint16 deltaX = fromX > toX ? fromX - toX : toX - fromX;
        uint16 deltaY = fromY > toY ? fromY - toY : toY - fromY;
        return deltaX + deltaY;
    }

    // Allows (0,1), (1,1), and (1,0) to all be the same distance from (0,0)
    function _chebyshevDistance(uint256 x1, uint256 y1, uint256 x2, uint256 y2) internal pure returns (uint16) {
        return uint16(_max(_absDiff(x1, x2), _absDiff(y1, y2)));
    }

    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function removeEntityFromBoard(bytes32 entityId) public {
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            bool senderIsOwner = IWorld(_world()).UD__isValidOwner(entityId, _msgSender());
            if (senderIsOwner) {
                bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
                if (encounterId != bytes32(0)) {
                    require(
                        CombatEncounter.getCurrentTurn(encounterId) < 3, "Can only run from combat in the beginning"
                    );
                }
            } else if (bytes32(abi.encode(SystemRegistry.getSystemId(_msgSender()))) == bytes32(0)) {
                require(
                    (SessionTimer.get(entityId) + SESSION_TIMEOUT) < block.timestamp,
                    "This player's session has not timed out"
                );
            } else {
                _requireAccess(address(this), _msgSender());
            }
        } else {
            _requireAccess(address(this), _msgSender());
        }
        (uint16 currentX, uint16 currentY) = getEntityPosition(entityId);
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
        Position.set(entityId, 0, 0);
        Spawned.setSpawned(entityId, false);

        bytes32 encounterId = EncounterEntity.getEncounterId(entityId);
        bytes32[] memory emptyArray;

        // end combat for entity
        if (encounterId != bytes32(0)) {
            bytes32[] memory attackers = CombatEncounter.getAttackers(encounterId);
            for (uint256 i; i < attackers.length; i++) {
                EncounterEntity.setEncounterId(attackers[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(attackers[i], emptyArray);
            }
            bytes32[] memory defenders = CombatEncounter.getDefenders(encounterId);
            for (uint256 i; i < defenders.length; i++) {
                EncounterEntity.setEncounterId(defenders[i], bytes32(0));
                EncounterEntity.setAppliedStatusEffects(defenders[i], emptyArray);
            }
            EncounterEntity.setDied(entityId, true);
            CombatEncounter.setEnd(encounterId, block.timestamp);
        }
        require(entityWasAtPosition, "Entity not at position");
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
        require(entityWasAtPosition, "Entity not at position");
        // if character set session timer
        if (IWorld(_world()).UD__isValidCharacterId(entityId)) {
            SessionTimer.set(entityId, block.timestamp);
        }
        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
    }
}
