// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ItemType, Classes, Alignment, TokenType} from "@codegen/common.sol";
import {
    StatusEffectStatsData,
    WeaponStatsData,
    ArmorStatsData,
    MagicDamageStatsData,
    PhysicalDamageStatsData,
    StatRestrictionsData,
    StatusEffectsValidityData
} from "@codegen/index.sol";

/////////////////// Items ///////////////////////

struct WeaponTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    StatRestrictionsData statRestrictions;
    WeaponStatDetails stats;
}

struct ArmorTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    StatRestrictionsData statRestrictions;
    ArmorStatDetails stats;
}

struct ArmorStatDetails {
    int256 agiModifier;
    int256 armorModifier;
    int256 hpModifier;
    int256 intModifier;
    uint256 minLevel;
    int256 strModifier;
}

struct WeaponStatDetails {
    int256 agiModifier;
    bytes32[] effects;
    int256 hpModifier;
    int256 intModifier;
    int256 maxDamage;
    int256 minDamage;
    uint256 minLevel;
    int256 strModifier;
}

struct StarterItems {
    ArmorTemplateDetails[] armor;
    string metadataUriPrefix;
    WeaponTemplateDetails[] weapons;
}

struct StarterEffects {
    MagicDamageTemplate[] MagicDamages;
    PhysicalDamageTemplate[] PhysicalDamages;
    StatusEffectTemplate[] statusEffects;
}

struct StatusEffectTemplate {
    bytes32 effectId;
    string name;
    StatusEffectStatsData stats;
    StatusEffectsValidityData validity;
}

struct MagicDamageTemplate {
    bytes32 effectId;
    string name;
    MagicDamageStatsData stats;
}

struct PhysicalDamageTemplate {
    bytes32 effectId;
    string name;
    PhysicalDamageStatsData stats;
}

struct AdjustedCombatStats {
    int256 adjustedStrength;
    int256 adjustedAgility;
    int256 adjustedIntelligence;
    int256 adjustedArmor;
    int256 adjustedMaxHp;
    int256 currentHp;
    uint256 level;
}

/////////////////////////////////// MONSTERS /////////////////////////////////////

struct MonsterStats {
    //base to hit number for this mob for physical attacks = agility * PhysicalDamageConversion
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

struct Attack {
    bytes32 attackerEntityId;
    bytes32 defenderEntityId;
    uint256 itemId;
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

//////////////////////////////////// Auction house /////////////////////////////////////

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
