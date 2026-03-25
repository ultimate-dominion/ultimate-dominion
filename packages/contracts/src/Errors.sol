// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

// Access control
error Unauthorized();
error NotAdmin();
error GamePaused();
error InvalidShopEntity();

// Character
error CharacterLocked();
error InvalidCharacter();
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
error CannotLevelInCombat();
error MaxCharacters();
error NameTaken();
error InvalidAccount();
error InvalidTokenUri();
error InvalidStarterItem();
error InsufficientStat();
error InvalidItemType();
error MustChooseRaceFirst();
error MustChoosePowerSourceFirst();
error MaxStatRollsExceeded();
error CharacterDead();

// Shop
error NotAtShopPosition();
error OutOfStock();
error InsufficientItemBalance();
error ShopInsufficientGold();
error NotOwnShopEncounter();

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
error InvalidGroupSize();
error CombatantHpZero();
error NotInEncounter();
error CanOnlyFleeFirstTurn();
error InvalidFlee();
error UnrecognizedEncounterType();

// Map
error OnlyCharacters();
error NotSpawned();
error AlreadySpawned();
error InEncounter();
error OutOfBounds();
error InvalidMove();
error MaxPlayers();
error NoMonsters();
error NoWeaponsEquipped();
error EntityNotAtPosition();
error UseFleeFunction();
error SessionNotTimedOut();
error MoveTooFast();
error NotAtRestPosition();
error ZoneLevelTooLow();
error ZoneNotConfigured();
error AlreadyInZone();
error PrerequisiteZoneIncomplete();

// Items
error ArrayMismatch();
error NotWeapon();
error NotArmor();
error NotConsumable();
error NoSupply();
error NotItemOwner();
error MustUnequipItem();
error OnlyHealingInCombat();

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

// Combat
error ActionNotFound();
error ItemNotEquipped();
error ActionTypeNotRecognized();
error InvalidMagicItemType();
error InvalidAction();
error UnrecognizedResistanceStat();
error InvalidMoves();
error UnrecognizedCombatType();
error UnrecognizedRequestType();

// Mob
error MaxMobTypes();
error MobArrayMismatch();
error WrongMobType();
error MaxMobSpawns();

// Stats
error NegativeStat();

// GasStation
error GasStationDisabled();
error GasStationCooldownActive();
error GasStationMaxSwapExceeded();
error GasStationInsufficientTreasury();
error GasStationBelowMinLevel();
error GasStationTransferFailed();
error GasStationZeroAmount();
error GasStationSwapFailed();
error GasStationNotRelayer();
error GasStationArrayMismatch();
