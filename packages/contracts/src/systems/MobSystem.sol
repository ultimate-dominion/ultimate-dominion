// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    Counters,
    Position,
    EntitiesAtPosition,
    MobsByLevel,
    Mobs,
    MobsData,
    MobStats,
    MobStatsData
} from "@codegen/index.sol";
import {MobType, PowerSource, Race, ArmorType, AdvancedClass} from "@codegen/common.sol";
import {MonsterStats, NPCStats, AdjustedCombatStats} from "@interfaces/Structs.sol";
import {Stats, StatsData, Spawned, ShopsData, Shops} from "@codegen/index.sol";
import {_requireOwner, _requireAccess, _requireAccessOrAdmin} from "../utils.sol";
import {MAX_MONSTERS} from "../../constants.sol";

contract MobSystem is System {
    /**
     *  @dev this creates a mob template that can be spawned into the world at any tile location
     *  @param mobType the type of mob this is Monster or NPC for now
     *  @param stats the encoded bytes struct of the stats of this particular mob encode MonsterStats for a monster and NPCStats for an npc
     *  @param mobMetadataUri the uri for an associated metadata for the mob
     *  @return mobId, the identifier for this mob template
     */
    function createMob(MobType mobType, bytes memory stats, string memory mobMetadataUri) public returns (uint256) {
        _requireAccessOrAdmin(address(this), _msgSender());
        uint256 mobId = _incrementMobId();
        require(mobId < type(uint32).max, "MOB SYSTEM: Max Monster types reached");
        Mobs.set(mobId, mobType, stats, mobMetadataUri);
        if (mobType == MobType.Monster) {
            MonsterStats memory newMob = abi.decode(stats, (MonsterStats));
            MobsByLevel.pushMobIds(newMob.level, mobId);
        }
        return mobId;
    }

    function createMobs(MobType[] memory mobTypes, bytes[] memory stats, string[] memory mobMetadataURIs) public {
        uint256 len = mobTypes.length;
        require(mobMetadataURIs.length == len && stats.length == len, "MOB SYSTEM: Array length mismatch");
        for (uint256 i; i < len; i++) {
            createMob(mobTypes[i], stats[i], mobMetadataURIs[i]);
        }
    }

    function spawnMobs(uint256[] memory mobIds, uint16 x, uint16 y) public {
        for (uint256 i; i < mobIds.length; i++) {
            spawnMob(mobIds[i], x, y);
        }
    }

    function spawnMob(uint256 mobId, uint16 x, uint16 y) public returns (bytes32 entityId) {
        require(Counters.getCounter(address(this), 0) >= mobId, "MOB SYSTEM: Mob does not exist");
        entityId = bytes32(abi.encodePacked(uint32(mobId), uint192(_incrementMobCounter(mobId)), x, y));
        MobsData memory stats = Mobs.get(mobId);
        if (stats.mobType == MobType.Monster) {
            // worst case scenario assuming shops are always first:
            // loops through all the shops and MAX_MONSTERS monsters
            // normal scenario
            // loops through all the shops
            uint256 nonMonsters = 0;
            bytes32[] memory entities = EntitiesAtPosition.getEntities(x, y);
            // loop through all the entities
            for (uint256 i = 0; i < entities.length; ++i) {
                // if there are less than max monsters we can certainly add another
                if (entities.length < (MAX_MONSTERS + 1)) {
                    break;
                }
                // if there are more than max monsters start looking for non-monsters
                else if (Mobs.get(getMobId(entities[i])).mobType != MobType.Monster) {
                    ++nonMonsters;
                    // if there are non monsters, check if we are now under MAX_MONSTERS
                    if (entities.length - nonMonsters < (MAX_MONSTERS + 1) - 1) break;
                    // if all MAX_MONSTERS are monsters do something here
                    return entities[i];
                }
                return entities[i];
            }
            MonsterStats memory monsterStats = abi.decode(stats.mobStats, (MonsterStats));
            StatsData memory statsData = StatsData({
                strength: monsterStats.strength,
                agility: monsterStats.agility,
                intelligence: monsterStats.intelligence,
                maxHp: monsterStats.hitPoints,
                class: monsterStats.class,
                currentHp: monsterStats.hitPoints,
                experience: monsterStats.experience,
                level: monsterStats.level,
                powerSource: PowerSource.None,
                race: Race.None,
                startingArmor: ArmorType.None,
                advancedClass: AdvancedClass.None,
                hasSelectedAdvancedClass: false
            });
            MobStatsData memory newMobStats =
                MobStatsData({armor: monsterStats.armor, inventory: monsterStats.inventory});
            MobStats.set(entityId, newMobStats);
            Stats.set(entityId, statsData);
        } else if (stats.mobType == MobType.Shop) {
            ShopsData memory shopStats = abi.decode(stats.mobStats, (ShopsData));

            Shops.set(entityId, shopStats);
        }

        Position.set(entityId, x, y);
        EntitiesAtPosition.pushEntities(x, y, entityId);
        Spawned.set(entityId, true);
    }

    function getMobId(bytes32 entityId) public pure returns (uint256) {
        return uint256(uint256(entityId) >> 224);
    }

    function getMobPositionFromId(bytes32 entityId) public pure returns (uint16 x, uint16 y) {
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

    function getMonsterCombatStats(bytes32 entityId)
        public
        view
        returns (AdjustedCombatStats memory _spawnedMonsterStats)
    {
        MobsData memory mobData = Mobs.get(getMobId(entityId));
        require(mobData.mobType == MobType.Monster, "MOB SYSTEM: Wrong Entity Type");
        StatsData memory statsData = Stats.get(entityId);
        _spawnedMonsterStats.agility = statsData.agility;
        _spawnedMonsterStats.armor = MobStats.getArmor(entityId);
        _spawnedMonsterStats.strength = statsData.strength;
        _spawnedMonsterStats.intelligence = statsData.intelligence;
        _spawnedMonsterStats.maxHp = statsData.maxHp;
        _spawnedMonsterStats.currentHp = statsData.currentHp;
    }

    function isValidMob(bytes32 entityId) public view returns (bool _isValidMob) {
        uint256 mobId = getMobId(entityId);
        if (Mobs.getMobStats(mobId).length != 0) {
            _isValidMob = true;
        }
    }

    function getMob(uint256 mobId) public view returns (MobsData memory) {
        return Mobs.get(mobId);
    }

    function getMob(bytes32 entityId) public view returns (MobsData memory) {
        uint256 mobId = getMobId(entityId);
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
