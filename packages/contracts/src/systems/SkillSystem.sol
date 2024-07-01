// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    MatchEntity,
    SkillsData,
    Skills,
    Stats,
    CombatEncounter,
    CombatEncounterData
} from "@codegen/index.sol";
import {RngRequestType, MobType, EncounterType, SkillType} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {Mobs, MobsData} from "@tables/Mobs.sol";
import {MonsterStats, NPCStats} from "@interfaces/Structs.sol";
import {_requireOwner, _requireAccess} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";
import {DEFAULT_MAX_TURNS} from "../../constants.sol";

contract SkillSystem is System {
    function createSkill(SkillType skillType, bytes memory skillStats) public returns (bytes32 skillId) {
        _requireOwner(address(this), _msgSender());
        skillId = keccak256(skillStats);
        require(
            Skills.getSkillStats(skillId).length == 0 && uint8(Skills.getSkillType(skillId)) == uint8(0),
            "Skill already exists"
        );
        Skills.set(skillId, skillType, skillStats);
    }
}
