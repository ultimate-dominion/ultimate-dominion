# Contributing to Ultimate Dominion

Thank you for considering contributing to the Ultimate Dominion. We welcome any contributions that can help improve the project, including bug reports, feature requests, and code changes.

## Getting Started

Contributions are made to this repo via Issues and Pull Requests (PRs).

To run the code locally, you will need to fork the code, and follow the instructions [here](https://github.com/raid-guild/ultimate-dominion/blob/dev/README.md).

### Issues

- [Frontend Issues](https://github.com/raid-guild/ultimate-dominion/issues?q=is%3Aopen+is%3Aissue+label%3Afrontend)
- [Smart Contract Issues](https://github.com/raid-guild/ultimate-dominion/issues?q=is%3Aopen+is%3Aissue+label%3A%22smart+contracts%22)

Issues should be used to report bugs, explain UX problems, request a new feature, or to discuss potential changes before a PR is created. When you create a new Issue, a template will be loaded that will guide you through collecting and providing the information we need to investigate.

If you find an issue you want to work on, follow the Commits and Pull Request instructions!

### Commits

As best as possible, try to follow Conventional Commit patterns as described here.
Pull Requests

In general, PRs should:

- Address a single concern in the least number of changed lines as possible.
- Include documentation in the repo or on our docs site if applicable.
- Be accompanied by a complete Pull Request template (loaded automatically when a PR is created).

In general, we follow the ["fork-and-pull" Git workflow](https://github.com/susam/gitpr)

1. Fork the repository to your own Github account
2. Clone the project to your machine
3. Create a branch locally with a succinct but descriptive name
4. Commit changes to the branch (see Commits instructions)
5. Push changes to your fork
6. Open a PR in our repository and follow the PR template so that we can efficiently review the changes.

## Getting Help

Join us in the [RaidGuild Discord](https://discord.gg/dGz3CT8a) and post your question #product-support channel.

# Game Mechanics

## Creating New Items

### Item Stats

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

`createItem` parameters:

- ItemType: enum declaring the type of item. `ItemType: ["Weapon", "Armor", "Spell", "Consumable", "QuestItem"],`
- supply: the amount of this item you want to create. between one and `type(uint256).max`
- dropchance: the % chance that this item will be dropped if it is in a mob's inventory
- price: the base cost in wei to buy this item in a store
- stats: The `stats` argument will consist of 2 structs encoded together, the stats struct and then the stat restrictions struct. `abi.encode(weaponStatsData, statRestictionsData)`
- metadata: the string for the items metadata storage address

### Stats Structs to Encode for Item Creation

For Armor:

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

For Weapons:

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

For Spells:

```
struct SpellStatsData {
  int256 minDamage;
  int256 maxDamage;
  uint256 minLevel;
  bytes32[] effects;
}
```

For Consumables:

```
struct ConsumableStatsData {
  int256 minDamage;
  int256 maxDamage;
  uint256 minLevel;
  bytes32[] effects;
}
```

### Stat Restrictions

Due to limited space in Mud tables, stat restrictions must also be separated from the base item stats.

All Items must also include a `statRestrictions` struct encoded with the base stats.

```
struct StatRestrictionsData {
  int256 minAgility;
  int256 minIntelligence;
  int256 minStrength;
}
```

### Effects

You will notice that weapons, spells, and consumables have a common `effects` array in their stats. To create an effect you must use `UD__createEffect(EffectType effectType, string memory name, bytes memory effectStats)`.

There are 4 effect types: `EffectType: ["Temporary", "PhysicalDamage", "MagicDamage", "StatusEffect"]`

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

All stats can be positive or negative. If you want an attack to have a higher chance to hit, but do less damage, you could
have `attackModifierBonus = 10` and `bonusDamage = -2`. This would add a 10% higher chance to hit and subtract 2 from the final damage output.

You can also add any number of effects to any item. All will be applied when the item is used.

`MagicDamage` and `PhysicalDamage` will apply the damage listed in the item stats and any bonuses from the effect stats.

The `effects` dictate the kind of effect using this item will have. If there is no `effectId` in the `effects` array, your item will have no effect when used. For example, if you want an item to deal a physical damage effect, you would pass that `effectId` in the array. If you want it to have a poisoning effect, you can add that as an additional `effectId`.

### Status Effects

To create a new effect someone with `adminAccess` must call
`UD__createEffect(EffectType effectType, string memory name, bytes memory effectStats)`

When encoding the structs for status effect (similar to encoding structs for the items), the bytes data you pass in will be created from the encoded
stats and validity data (e.g. `abi.encode(statusEffectStatsData, statusEffectValidityData)`).

**There are two types of status effects: World Status Effects and Combat Status Effects.**

- World Status Effects: applied only out of combat and use the `validTime` variable. This will be the number of seconds this effect will last for.
- Combat Status Effects: applied only during combat and use the `validTurns`. This is the number of turns the effect is valid for.

**If you have a validTime, validTurns must be 0, and vice versa.**

Validity structs:

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

_For example effects check out the effects.json file._

### Effect ids

The `effectId` is taken by hashing the name of the effect, taking the first 8 bytes and then padding the zeros to 32 bytes. For example, the basic weapon attack effect ID is `0xbeeab8b096ac11af000000000000000000000000000000000000000000000000`
derived from `bytes8(keccak256(abi.encode("basic weapon attack")));`. The rest of the 32 bytes is filled in with data when the effect is applied and removed as a temporary on-chain effect ID.

### Creating New Mobs

To create a mob, use the `createMob` function: `createMob(MobType mobType, bytes memory stats, string memory mobMetadataUri)`.

There are 3 mob types: `MobType: ["Monster", "NPC", "Shop"],`

All mobs, monsters and players have the same base stats. The _stats_ argument in `createMob` is the `StatsData` struct encoded with `abi.encode(statsData)`:

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

_For example mobs checkout the monsters.json._
