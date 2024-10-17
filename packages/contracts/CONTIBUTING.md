### Contributing to Ultimate-Dominion

## Getting Started

Contributions are made to this repo via Issues and Pull Requests (PRs).

To run the code locally, you will need to fork the code, and follow the instructions [here](https://github.com/raid-guild/ultimate-dominion/blob/dev/README.md).
Issues

    Frontend Issues
    Subgraph Issues
    Smart Contract Issues

Issues should be used to report bugs, explain UX problems, request a new feature, or to discuss potential changes before a PR is created. When you create a new Issue, a template will be loaded that will guide you through collecting and providing the information we need to investigate.

If you find an issue you want to work on, follow the Commits and Pull Request instructions!
Commits

As best as possible, try to follow Conventional Commit patterns as described here.
Pull Requests

In general, PRs should:

    Address a single concern in the least number of changed lines as possible.
    Include documentation in the repo or on our docs site if applicable.
    Be accompanied by a complete Pull Request template (loaded automatically when a PR is created).

In general, we follow the "fork-and-pull" Git workflow

    Fork the repository to your own Github account
    Clone the project to your machine
    Create a branch locally with a succinct but descriptive name
    Commit changes to the branch (see Commits instructions)
    Push changes to your fork
    Open a PR in our repository and follow the PR template so that we can efficiently review the changes.

Getting Help
Join us in the RaidGuild Discord and post your question #product-support channel.

#### Game Mechanics

### Creating New Items

## Item Stats

Items in this game are ERC-1155 tokens. There are 4 different types of data.

1. Armor

2. Weapons

3. Spells

4. Consumables

All items have common variables that must be decided upon on item creation.

```
createItem(
        ItemType itemType,
        uint256 supply,
        uint256 dropChance,
        uint256 price,
        bytes memory stats,
        string memory itemMetadataURI
    )
```

- ItemType: enum declaring the type of item. `ItemType: ["Weapon", "Armor", "Spell", "Consumable", "QuestItem"],`
- supply: the amount of this item you want to create. between one and `type(uint256).max`
- dropchance: the % chance that this item will be dropped if it is in a mob's inventory.
- price: the base cost in wei to buy this item in a store
- stats: The `stats` argument will consist of 2 structs encoded together, the stats struct and then the stat restrictions struct. `abi.encode(weaponStatsData, statRestictionsData)`
- metadata: the string for the items metadata storage address

# Stats structs to encode for item creation

for Armor

```
struct ArmorStatsData {
int256 agiModifier;
int256 armorModifier;
int256 hpModifier;
int256 intModifier;
uint256 minLevel;
int256 strModifier;
}
```

for Weapons

```
struct WeaponStatsData {
int256 agiModifier;
int256 intModifier;
int256 hpModifier;
int256 maxDamage;
int256 minDamage;
uint256 minLevel;
int256 strModifier;
bytes32[] effects;
}
```

for Spells

```
struct SpellStatsData {
  int256 minDamage;
  int256 maxDamage;
  uint256 minLevel;
  bytes32[] effects;
}
```

for Consumables

```
struct ConsumableStatsData {
  int256 minDamage;
  int256 maxDamage;
  uint256 minLevel;
  bytes32[] effects;
}
```

# Stat Restrictions

Do to limited space in Mud tables stat restrictions must also be seperated from the base item stats.

All Items must also include a statRestrictions struct encoded with the base stats.

```
struct StatRestrictionsData {
  int256 minAgility;
  int256 minIntelligence;
  int256 minStrength;
}
```

these are separated due to the restrictions in the mud engine's table size.

# Effects

You will notice that weapons, spells and consumables have a common `effects` array in their stats.

to create an effect you must use `UD__createEffect(EffectType effectType, string memory name, bytes memory effectStats)`

there are 4 effet types:
EffectType: ["Temporary", "PhysicalDamage", "MagicDamage", "StatusEffect"],

the `effects` dictate the kind of effect using this item will have. if there is no effectId in the effects array your item will have no effect when used.

there are 4 types of effects `EffectType: ["Temporary", "PhysicalDamage", "MagicDamage", "StatusEffect"],`.

for example a physical weapon will generally deal physical damage (but it doesn't have to, you can add any effect to any item with an effects array).

```
struct PhysicalDamageStatsData {
  int256 armorPenetration; // the number of armor points this attack will negate
  int256 attackModifierBonus; // added chance to hit the opponent when to-hit calcs are done
  int256 bonusDamage; // extra damage added on after base damage is calculated
  int256 critChanceBonus; // added critical chance
}

struct MagicDamageStatsData {
int256 attackModifierBonus;
int256 bonusDamage;
int256 critChanceBonus;
}

struct StatusEffectStatsData {
  int256 agiModifier;
  int256 armorModifier;
  int256 damagePerTick;
  int256 hpModifier;
  int256 intModifier;
  ResistanceStat resistanceStat;
  int256 strModifier;
}

```

all stats can be positive or negative. if you want an attack to have a higher chance to hit but do less damage you could
have `attackModifierBonus = 10` and `bonusDamage = -2` this would add a 10% higher chance to hit and subtract 2 from the final damage output.

you can also add any number of effects to any item, all will be applied whenever the item is used.

`MagicDamage` and `PhysicalDamage` will apply the damage listed in the item stats and any bonuses from the effect stats.

# Status Effects

To create a new effect someone with adminAccess must call
`UD__createEffect(EffectType effectType, string memory name, bytes memory effectStats)`

when encoding the structs for status effect, similar to the items the bytes data you pass in will be created from the encoded
stats and validity data...

e.g. `abi.encode(statusEffectStatsData, statusEffectValidityData)`

there are two types of status effects, World Status effects and combat status effects

- World Status effects: are applied out of combat and use the validTime variable. this will be the number of seconds this effect will last for.
- combat status effects: these effects are applied during combat and use the validTurns. this is the number of turns the effect is valid for

**If you have if validTime is set validTurns must be 0 and visa versa**

a world status effect cannot be used in combat and a combat status effect cannot be used out of combat.

Status Effects can be applied to any Item with an effects array. Status effects can apply positive or negative stat modifiers.

```
struct StatusEffectStatsData {
  int256 agiModifier;
  int256 armorModifier;
  int256 damagePerTick;
  int256 hpModifier;
  int256 intModifier;
  ResistanceStat resistanceStat;
  int256 strModifier;
}

struct StatusEffectValidityData {
  uint256 cooldown;
  uint256 maxStacks;
  uint256 validTime;
  uint256 validTurns;
}
```

_for example effects check out the effects.json file_

# Effect ids

The effect id is taken by hashing the name of the attack, taking the first 8 bytes and then padding the zeros to 32 bytes

for example the basic weapon attack is id `0xbeeab8b096ac11af000000000000000000000000000000000000000000000000`
derived from `bytes8(keccak256(abi.encode("basic weapon attack")));`

the rest of the 32 bytes is filled in with data when the effect is applied and removed as a temporary on chain effect Id.

### Creating new Mobs

`createMob(MobType mobType, bytes memory stats, string memory mobMetadataUri)`

- `MobType: ["Monster", "NPC", "Shop"],`

all mobs, monsters and players have the same base stats.

the _stats_ arg is the below struct encoded with `abi.encode(statsData)`

```
struct StatsData {
  int256 strength;
  int256 agility;
  Classes class;
  int256 intelligence;
  int256 maxHp;
  int256 currentHp;
  uint256 experience;
  uint256 level;
}
```

**for example mobs checkout the monsters.json**
