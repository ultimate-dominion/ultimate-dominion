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
    StatusEffectValidityData
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

struct SpellStatDetails {
    bytes32[] effects;
    int256 maxDamage;
    int256 minDamage;
    uint256 minLevel;
}

struct SpellTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    StatRestrictionsData statRestrictions;
    SpellStatDetails stats;
}

struct ConsumableTemplateDetails {
    uint256 dropChance;
    uint256 initialSupply;
    string metadataUri;
    string name;
    StatRestrictionsData statRestrictions;
    ConsumableStatDetails stats;
}

struct ConsumableStatDetails {
    bytes32[] effects;
    int256 maxDamage;
    int256 minDamage;
    uint256 minLevel;
}

struct StarterItems {
    ArmorTemplateDetails[] armor;
    ConsumableTemplateDetails[] consumables;
    string metadataUriPrefix;
    SpellTemplateDetails[] spells;
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
    StatusEffectValidityData validity;
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
    int256 strength;
    int256 agility;
    int256 intelligence;
    int256 armor;
    int256 maxHp;
    int256 currentHp;
}

/////////////////////////////////// MONSTERS /////////////////////////////////////

struct MonsterStats {
    //base to hit number for this mob for physical attacks = agility * PhysicalDamageConversion
    int256 agility;
    // damage reduction: subtracted from total damage
    int256 armor;
    // monster's class
    Classes class;
    // the amount of experience this monster is worth
    uint256 experience;
    // hit points
    int256 hitPoints;
    // base to hit modifier for magical Actions = inteligence * magicDefenseConversion
    int256 intelligence;
    // item ids of potential drops
    uint256[] inventory;
    // monster level
    uint256 level;
    // base damage = strength * damangeConversion
    int256 strength;
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

struct Action {
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
//////////////////////////////////// Shop /////////////////////////////////////

struct Shop {
    uint256 priceMarkup;
    uint256 priceMarkdown;
    uint256[] sellableItems;
    uint256[] buyableItems;

}