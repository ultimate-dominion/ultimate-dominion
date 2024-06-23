// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment} from "@codegen/common.sol";

struct WeaponStats {
    uint256 damage;
    uint256 speed;
    uint8[] classRestrictions;
}

struct MonsterStats {
    // hit points
    uint256 hp;
    // damage reduction % * 10 * 5 || 10000 = 1%
    uint256 armor;
    // monster level
    uint256 level;
    // base damage
    uint256 baseDamage;
    // monster's class
    Classes class;
    // item ids of potential drops
    uint256[] inventory;
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
