// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment} from "@codegen/common.sol";

struct WeaponStats {
    uint256 damage;
    uint256 speed;
    uint8[] classRestrictions;
    uint256 minLevel;
}

struct MonsterStats {
    // all stats (except level and exp) are to the 10,000s place.  so 10_000 == 1;
    // hit points
    uint256 hp;
    // damage reduction %
    uint256 armor;
    // monster level
    uint256 level;
    // base damage
    uint256 baseDamage;
    // monster's class
    Classes class;
    // item ids of potential drops
    uint256[] inventory;
    // the amount of experience this monster is worth
    uint256 experience;
}

struct NPCStats {
    string name;
    uint256[] storyPathIds;
    Alignment alignment;
}

struct QuestEntity {
    // entity id is a keccak256(characterId, questId))
    bytes32 entityId;
    uint256 questId;
    uint256 currentStep;
}

struct PhysicalAttack {
    uint256 baseDamage;
    // 0 = once per round, 1 = 1 round cool down etc.
    uint256 baseSpeed;
    // number of hits, divides base damage 3 hits == baseDmg/3
    uint256 numberOfHits;
}
