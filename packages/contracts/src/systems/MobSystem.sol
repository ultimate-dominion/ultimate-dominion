// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers, Position, PositionData, EntitiesAtPosition} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";

contract MobSystem is System {
    /**
     *  @dev this creates a mob template that can be spawned into the world at any tile location
     *  @param mobType the type of mob this is Monster or NPC for now
     *  @param mobStats the encoded bytes struct of the stats of this particular mob encode MonsterStats for a monster and NPCStats for an npc
     *  @param mobMetadataUri the uri for an associated metadata for the mob
     *  @return mobId, the identifier for this mob template
     */
    function createMob(MobType mobType, bytes memory mobStats, string memory mobMetadataUri) public returns (uint256) {
        _requireOwner(address(this), _msgSender());
        uint256 mobId = _incrementMobId();
        require(mobId < type(uint32).max, "MOB SYSTEM: Max Monster types reached");
        Mobs.set(mobId, mobType, mobStats, mobMetadataUri);

        return mobId;
    }

    function createMobs(MobType[] memory mobTypes, bytes[] memory stats, string[] memory mobMetadataURIs) public {
        uint256 len = mobTypes.length;
        require(mobMetadataURIs.length == len && stats.length == len, "MOB SYSTEM: Array length mismatch");
        for (uint256 i; i < len; i++) {
            createMob(mobTypes[i], stats[i], mobMetadataURIs[i]);
        }
    }

    function spawnMob(uint256 mobId, PositionData memory positionData) public returns (bytes32 entityId) {
        _requireAccess(address(this), _msgSender());
        require(Counters.getCounter(address(this), 0) >= mobId, "MOB SYSTEM: Mob does not exist");
        entityId = bytes32(
            abi.encodePacked(uint32(mobId), uint192(_incrementMobCounter(mobId)), positionData.x, positionData.y)
        );
        Position.set(entityId, positionData);
        EntitiesAtPosition.pushEntities(positionData.x, positionData.y, entityId);
    }

    function getMobId(bytes32 entityId) public pure returns (uint256) {
        return uint256(uint256(entityId) >> 224);
    }

    function getMobPosition(bytes32 entityId) public pure returns (uint16 x, uint16 y) {
        y = uint16(uint256(entityId));
        x = uint16(uint256(entityId) >> 16);
    }

    function getSpawnCounter(bytes32 entityId) public pure returns (uint256) {
        return uint256(uint192(uint256(entityId) >> 32));
    }

    function getNpcStats(uint256 mobId) public view returns (NPCStats memory) {
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.NPC, "MOB SYSTEM: Wrong Mob Type");
        NPCStats memory npcStats = abi.decode(mobData.mobStats, (NPCStats));
        return npcStats;
    }

    function getNpcStats(bytes32 entityId) public view returns (NPCStats memory) {
        uint256 mobId = getMobId(entityId);
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.NPC, "MOB SYSTEM: Wrong Mob Type");
        NPCStats memory npcStats = abi.decode(mobData.mobStats, (NPCStats));
        return npcStats;
    }

    function getMonsterStats(uint256 mobId) public view returns (MonsterStats memory) {
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.Monster, "MOB SYSTEM: Wrong Mob Type");

        MonsterStats memory monsterStats = abi.decode(mobData.mobStats, (MonsterStats));
        return monsterStats;
    }

    function getMonsterStats(bytes32 entityId) public view returns (MonsterStats memory) {
        uint256 mobId = getMobId(entityId);
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.Monster, "MOB SYSTEM: Wrong Mob Type");

        MonsterStats memory monsterStats = abi.decode(mobData.mobStats, (MonsterStats));
        return monsterStats;
    }

    function getMob(uint256 mobId) public view returns (MobsData memory) {
        return Mobs.get(mobId);
    }

    function _incrementMobId() internal returns (uint256) {
        uint256 mobId = Counters.getCounter(address(this), 0) + 1;
        Counters.setCounter(address(this), 0, (mobId));
        return mobId;
    }

    function _incrementMobCounter(uint256 mobId) internal returns (uint256) {
        uint256 mobCounter = Counters.getCounter(address(this), mobId) + 1;
        require(mobCounter < type(uint192).max, "MOB SYSTEM: Cannot spawn this monster any more");
        Counters.setCounter(address(this), mobId, mobCounter);
        return mobCounter;
    }
}
