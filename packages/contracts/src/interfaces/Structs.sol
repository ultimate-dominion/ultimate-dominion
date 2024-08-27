// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment, TokenType} from "@codegen/common.sol";

/////////////////// Items ///////////////////////
struct StatRestrictions {
    uint256 minAgility;
    uint256 minIntelligence;
    uint256 minStrength;
}

struct WeaponStats {
    bytes32[] actions;
    int256 agiModifier;
    int256 hitPointModifier;
    int256 intModifier;
    uint256 maxDamage;
    uint256 minDamage;
    uint256 minLevel;
    StatRestrictions statRestrictions;
    int256 strModifier;
}

struct ArmorStats {
    int256 agiModifier;
    uint256 armorModifier;
    int256 hitPointModifier;
    int256 intModifier;
    uint256 minLevel;
    StatRestrictions statRestrictions;
    int256 strModifier;
}

struct SpellStats {
    bytes32[] actions;
    int256 maxDamage;
    int256 minDamage;
    uint256 minLevel;
    StatRestrictions statRestrictions;
    bytes32[] statusEffects;
}

struct StatusEffect {
    int256 agiModifier;
    int256 armorModifier;
    int256 damagePerTick;
    int256 totalHitPointModifier;
    int256 intModifier;
    //the amount of time in seconds this status effect is valid for
    uint256 validTime;
    // the number of turns in combat this is valid for.
    uint256 validTurns;
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
    MagicAttackTemplate[] magicAttacks;
    PhysicalAttackTemplate[] physicalAttacks;
}

struct MagicAttackTemplate {
    bytes32 actionId;
    string name;
    MagicAttackStats stats;
}

struct PhysicalAttackTemplate {
    bytes32 actionId;
    string name;
    PhysicalAttackStats stats;
}
<<<<<<< Updated upstream
/////////////////////////////////// MONSTERS /////////////////////////////////////
=======

<<<<<<< Updated upstream
struct ArmorStats {
    int256 agiModifier;
    uint256 armorModifier;
    uint8[] classRestrictions;
    int256 hitPointModifier;
    int256 intModifier;
    uint256 minLevel;
    int256 strModifier;
}
=======
struct AdjustedCombatStats {
    uint256 adjustedStrength;
    uint256 adjustedAgility;
    uint256 adjustedIntelligence;
    uint256 adjustedArmor;
    uint256 adjustedMaxHp;
    int256 currentHp;
    uint256 level;
}

/////////////////////////////////// MONSTERS /////////////////////////////////////
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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

/////////////////////////// ACTIONS ///////////////////////////////////
struct Action {
    bytes32 attackerEntityId;
    bytes32 defenderEntityId;
    bytes32 actionId;
    uint256 weaponId;
}

struct PhysicalAttackStats {
    // base armor penetration
    int256 armorPenetration;
    //bonus chance to hit
    int256 attackModifierBonus;
    // additional damage on top of item damage
    int256 bonusDamage;
    // crit chance
    int256 critChanceBonus;
    uint256 minLevel;
    StatRestrictions statRestrictions;
    // status effects applied by this attack empty if none
    bytes32[] statusEffects;
}

struct MagicAttackStats {
    //bonus chance to hit
    int256 attackModifierBonus;
    int256 bonusDamage;
    // list of classes that can use this attack
    int256 critChanceBonus;
    // items that can cause this attack (leave empty if item not required)
    uint256[] itemRestrictions;
    // damage delt by this attack (can be negative for heals)
    int256 minDamage;
    int256 maxDamage;
    uint256 minLevel;
    StatRestrictions statRestrictions;
    // status effects applied by this attack
    bytes32[] statusEffects;
}

struct RewardDistributionTemps {
    bytes32 monsterTemp;
    bytes32 entityIdTemp;
    uint256 defenderLevelTemp;
    uint256 totalItemsDropped;
    uint256 livingPlayers;
    uint256 cumulativePlayerLevels;
    bytes32[] players;
    bytes32[] monsters;
}
<<<<<<< Updated upstream

////// Auction house /////////
=======
<<<<<<< Updated upstream
=======

//////////////////////////////////// Auction house /////////////////////////////////////
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
