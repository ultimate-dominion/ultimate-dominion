// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

// Access control
error Unauthorized();
error NotAdmin();
error GamePaused();
error InvalidShopEntity();

// Character
error CharacterLocked();
error InvalidRace();
error RaceAlreadySet();
error InvalidPowerSource();
error PowerSourceAlreadySet();
error InvalidArmorType();
error ArmorAlreadySet();
error InvalidAdvancedClass();
error AdvancedClassAlreadySet();
error RequiresLevel10();
error InvalidStatChange();
error MaxCharacters();
error NameTaken();
error CannotLevelInCombat();
error InvalidAccount();
error InvalidTokenUri();
error InvalidStarterItem();
error InsufficientStat();
error InvalidItemType();

// Encounter
error InvalidPvE();
error InvalidPvP();
error InvalidEncounter();
error ExpiredEncounter();
error NonCombatant();
error CannotEndTurn();
error NotCombatEncounter();
error EncounterAlreadyOver();
error InvalidEncounterType();
error InvalidWorldLocation();
error InvalidShopEncounter();
error AlreadyInEncounter();
error InvalidCombatEntity();

// Map
error OnlyCharacters();
error NotSpawned();
error AlreadySpawned();
error InEncounter();
error OutOfBounds();
error InvalidMove();
error MaxPlayers();
error NoMonsters();
error EntityNotAtPosition();
error UseFleeFunction();
error SessionNotTimedOut();

// Items
error ArrayMismatch();
error NotWeapon();
error NotArmor();
error NotConsumable();
error NoSupply();

// Effects
error InvalidEffectConfig();
error NonExistentIndex();
error InvalidEffect();
error InvalidEffectApplication();
error InvalidEffectType();
error EffectNotApplied();
error NotEffectType();

// Loot/Gold
error InvalidRewardState();
error NotAtSpawn();
error InsufficientBalance();
