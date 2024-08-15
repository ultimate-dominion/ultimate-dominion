// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment, TokenType} from "@codegen/common.sol";

struct WeaponStats {
    int256 agiModifier;
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

struct StarterActions {
    PhysicalAttackTemplate[] physicalAttacks;
}

struct PhysicalAttackTemplate {
    bytes32 actionId;
    string name;
    PhysicalAttackStats stats;
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

struct MonsterStats {
    // availible action ids
    bytes32[] actions;
    //base to hit number for this mob for physical attacks = agility * physicalAttackConversion
    uint256 agility;
    // damage reduction: subtracted from total damage
    uint256 armor;
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
}

struct PhysicalAttackStats {
    // base armor penetration
    int256 armorPenetration;
    //bonus chance to hit
    int256 attackModifierBonus;
    // additional damage on top of item damage
    int256 bonusDamage;
    uint8[] classRestrictions;
    // crit chance
    int256 critChanceBonus;
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

struct RewardDistributionTemps {
    bytes32 defenderTemp;
    bytes32 entityIdTemp;
    uint256 defenderLevelTemp;
    uint256 totalItemsDropped;
    uint256 livingAttackers;
    uint256 cumulativeAttackerLevels;
}

////// Auction house /////////

struct Offer {
    TokenType tokenType;
    address token;
    uint256 identifier;
    uint256 amount;
}

struct Consideration {
    TokenType tokenType;
    address token;
    uint256 identifier;
    uint256 amount;
    address recipient;
}

struct Order {
    Offer offer;
    Consideration consideration;
    bytes signature;
    address offerer;
}