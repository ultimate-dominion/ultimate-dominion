// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";

contract MobSystem is System {
    //
    function createMob(MobType mobType, bytes memory mobStats, string memory mobMetadataUri) public returns (uint256) {
        _requireOwner(address(this), _msgSender());
        uint256 mobId = _incrementMobId();

        Mobs.set(mobId, mobType, mobStats, mobMetadataUri);

        return mobId;
    }

    function createMobs(MobType[] memory mobTypes, bytes[] memory stats, string[] memory mobMetadataURIs) public {
        uint256 len = mobTypes.length;
        require(mobMetadataURIs.length == len && stats.length == len, "MobS: Array length mismatch");
        for (uint256 i; i < len; i++) {
            createMob(mobTypes[i], stats[i], mobMetadataURIs[i]);
        }
    }

    function getNpcStats(uint256 mobId) public view returns (NPCStats memory) {
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.NPC, "MobSystem: Wrong Mob Type");
        NPCStats memory npcStats = abi.decode(mobData.mobStats, (NPCStats));
        return npcStats;
    }

    function getMonsterStats(uint256 mobId) public view returns (MonsterStats memory) {
        MobsData memory mobData = Mobs.get(mobId);
        require(mobData.mobType == MobType.Monster, "MobSystem: Wrong Mob Type");

        MonsterStats memory monsterStats = abi.decode(mobData.mobStats, (MonsterStats));
        return monsterStats;
    }

    function getMob(uint256 mobId) public view returns (MobsData memory) {
        return Mobs.get(mobId);
    }

    function _incrementMobId() internal returns (uint256) {
        uint256 mobId = Counters.getCounter(address(this)) + 1;
        Counters.setCounter(address(this), (mobId));
        return mobId;
    }
}
