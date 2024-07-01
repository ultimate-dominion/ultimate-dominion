// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment} from "@codegen/common.sol";

struct WeaponStats {
    uint256 minDamage;
    uint256 maxDamage;
    uint8[] classRestrictions;
    int256 hitPointModifier;
    int256 intModifier;
    uint256 maxDamage;
    uint256 minDamage;
    uint256 minLevel;
    int256 strModifier;
}

struct WeaponTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    WeaponStats stats;
}

struct ArmorTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    ArmorStats stats;
}

struct StarterItems {
    ArmorTemplateDetails[] armor;
    string metadataUriPrefix;
    WeaponTemplateDetails[] weapons;
}

struct ArmorStats {
    int256 agiModifier;
    uint256 armorModifier;
    uint8[] classRestrictions;
    int256 hitPointModifier;
    int256 intModifier;
    uint256 minLevel;
    int256 strModifier;
}

struct ArmorStats {
    uint256 armorModifier;
    uint8[] classRestrictions;
    uint256 minLevel;
    int256 strModifier;
    int256 agiModifier;
    int256 intModifier;
    int256 hitPointModifier;
}

struct MonsterStats {
    // hit points
    uint256 hitPoints;
    // damage reduction: subtracted from total damage
    uint256 armor;
    // base damage = strength * damangeConversion
    uint256 strength;
    //base to hit number for this mob for physical attacks = agility * physicalAttackConversion
    uint256 agility;
    // base to hit modifier for magical Attacks = inteligence * magicDefenseConversion
    uint256 intelligence;
    // monster level
    uint256 level;
    // monster's class
    Classes class;
    // the amount of experience this monster is worth
    uint256 experience;
    // hit points
    uint256 hitPoints;
    // base to hit modifier for magical Attacks = inteligence * magicDefenseConversion
    uint256 intelligence;
    // item ids of potential drops
    uint256[] inventory;
    // monster level
    uint256 level;
    // base damage = strength * damangeConversion
    uint256 strength;
}

struct MonsterTemplateDetails {
    string metadataUri;
    string name;
    MonsterStats stats;
}

struct AdjustedCombatStats {
    uint256 adjustedStrength;
    uint256 adjustedAgility;
    uint256 adjustedIntelligence;
    uint256 adjustedArmor;
    uint256 adjustedMaxHp;
    int256 currentHp;
    uint256 level;
    uint256 class;
}

struct PhysicalAttackStats {
    // additional damage on top of item damage
    int256 bonusDamage;
    // base armor penetration
    int256 armorPenetration;
    //bonus chance to hit
    int256 attackModifierBonus;
    // crit chance
    int256 critChanceBonus;
    uint8[] classRestrictions;
}

struct Action {
    bytes32 attackerEntityId;
    bytes32 defenderEntityId;
    bytes32 actionId;
    uint256 weaponId;
}

struct MagicAttackStats {
    // additional damage on top of item damage
    uint256 bonusDamage;
    // list of items that can deal this attack
    uint256[] requiredItems;
    // base armor penetration
    uint256 armorPenetration;
}

struct PhysicalAttackStats {
    // additional damage on top of item damage
    uint256 bonusDamage;
    // list of items that can deal this attack
    uint256[] requiredItems;
    // base armor penetration
    uint256 armorPenetration;
}

struct CombatMove {
    bytes32 attackerEntityId;
    bytes32 defenderEntityId;
    bytes32 skillId;
    uint256 weaponId;
}

struct MagicAttackStats {
    // additional damage on top of item damage
    uint256 bonusDamage;
    // list of items that can deal this attack
    uint256[] requiredItems;
    // base armor penetration
    uint256 armorPenetration;
}

struct NPCStats {
    string name;
    bytes32[] storyPathIds;
    Alignment alignment;
}

struct QuestEntity {
    // entity id is a keccak256(characterId, questId))
    bytes32 entityId;
    uint256 questId;
    uint256 currentStep;
}
