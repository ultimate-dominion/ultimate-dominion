import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "UD",
  deploy: {
    upgradeableWorldImplementation: true,
    customWorld: false,
    modules: [
      {
        name: "StandardDelegationsModule",
        root: true,
        args: [],
      },
    ],
  },
  userTypes: {
    ResourceId: {
      filePath: "@latticexyz/store/src/ResourceId.sol",
      type: "bytes32",
    },
  },
  systems: {
    EquipmentCore: {
      name: "EquipmentCore",
      openAccess: true,
    },
    // Character Systems (modular) - using existing contract names
    CharacterCore: {
      name: "CharacterCore",
      openAccess: true,
    },
    CharacterEnterSystem: {
      name: "CharEnterSys",
      openAccess: true,
    },
    StatSystem: {
      name: "StatSystem", 
      openAccess: true,
    },
    LevelSystem: {
      name: "LevelSystem",
      openAccess: true,
    },
    ImplicitClassSystem: {
      name: "ImplicitClassSys",
      openAccess: true,
    },
    // Equipment Systems
    WeaponSystem: {
      name: "WeaponSystem",
      openAccess: true,
    },
    ArmorSystem: {
      name: "ArmorSystem",
      openAccess: true,
    },
    ConsumableSystem: {
      name: "ConsumableSystem",
      openAccess: true,
    },
    AccessorySystem: {
      name: "AccessorySystem",
      openAccess: true,
    },
    PhysicalCombat: {
      name: "PhysicalCombat",
      openAccess: true,
    },
    MagicCombat: {
      name: "MagicCombat",
      openAccess: true,
    },
    StatusEffects: {
      name: "StatusEffects",
      openAccess: true,
    },
    // World Action System - consumables and world interactions
    WorldActionSystem: {
      name: "WorldActionSys",
      openAccess: true,
    },
    // Fragment System - lore NFTs
    FragmentSystem: {
      name: "FragmentSystem",
      openAccess: true,
    },
    FragmentCombatSystem: {
      name: "FragCombatSys",
      openAccess: true,
    },
    AdminShopSystem: {
      name: "AdminShopSys",
      openAccess: false,
    },
    PvpRewardSystem: {
      name: "PvpRewardSystem",
      openAccess: true,
    },
    MapSpawnSystem: {
      name: "MapSpawnSystem",
      openAccess: true,
    },
    ItemCreationSystem: {
      name: "ItemCreationSys",
      openAccess: false,
    },
    EffectDataSystem: {
      name: "EffectDataSys",
      openAccess: false,
    },
    PveRewardSystem: {
      name: "PveRewardSystem",
      openAccess: true,
    },
    PauseSystem: {
      name: "PauseSystem",
      openAccess: false,
    },
    // Admin systems (not previously listed)
    AdminSystem: {
      name: "AdminSystem",
      openAccess: false,
    },
    AdminEntitySystem: {
      name: "AdminEntSys",
      openAccess: false,
    },
    AdminContentSystem: {
      name: "AdminContSys",
      openAccess: false,
    },
    AdminTuningSystem: {
      name: "AdminTuningSys",
      openAccess: false,
    },
    UltimateDominionConfigSystem: {
      name: "UDConfigSys",
      openAccess: false,
    },
    // Player-facing systems (previously auto-discovered with defaults)
    MapSystem: {
      name: "MapSystem",
      openAccess: true,
    },
    MapRemovalSystem: {
      name: "MapRemovalSys",
      openAccess: true,
    },
    ShopSystem: {
      name: "ShopSystem",
      openAccess: true,
    },
    MarketplaceSystem: {
      name: "MarketplaceSys",
      openAccess: true,
    },
    EncounterSystem: {
      name: "EncounterSys",
      openAccess: true,
    },
    EncounterResolveSystem: {
      name: "EncounterResSys",
      openAccess: true,
    },
    EquipmentSystem: {
      name: "EquipmentSystem",
      openAccess: true,
    },
    PvPSystem: {
      name: "PvPSystem",
      openAccess: true,
    },
    PvESystem: {
      name: "PvESystem",
      openAccess: true,
    },
    CombatSystem: {
      name: "CombatSystem",
      openAccess: true,
    },
    LootManagerSystem: {
      name: "LootManagerSyste",
      openAccess: true,
    },
    MobSystem: {
      name: "MobSystem",
      openAccess: true,
    },
    ItemsSystem: {
      name: "ItemsSystem",
      openAccess: true,
    },
    EffectsSystem: {
      name: "EffectsSystem",
      openAccess: true,
    },
    UtilsSystem: {
      name: "UtilsSystem",
      openAccess: true,
    },
    GasStationSystem: {
      name: "GasStationSys",
      openAccess: true,
    },
  },
  enums: {
    // Legacy class enum - kept for backward compatibility
    Classes: [
      "Warrior", // 0
      "Rogue", // 1
      "Mage", // 2
    ],
    // New implicit class system enums
    PowerSource: [
      "None", // 0
      "Divine", // 1
      "Weave", // 2
      "Physical", // 3
    ],
    Race: [
      "None", // 0
      "Human", // 1
      "Elf", // 2
      "Dwarf", // 3
    ],
    ArmorType: [
      "None", // 0
      "Cloth", // 1
      "Leather", // 2
      "Plate", // 3
    ],
    AdvancedClass: [
      "None", // 0
      // STR + Divine
      "Paladin", // 1
      // STR + Weave
      "Sorcerer", // 2
      // STR + Physical
      "Warrior", // 3
      // AGI + Divine
      "Druid", // 4
      // AGI + Weave
      "Warlock", // 5
      // AGI + Physical
      "Ranger", // 6
      // INT + Divine
      "Cleric", // 7
      // INT + Weave
      "Wizard", // 8
      // INT + Physical
      "Rogue", // 9
    ],
    RngRequestType: ["World", "CharacterStats", "Combat"],
    ItemType: ["Weapon", "Armor", "Spell", "Consumable", "QuestItem", "Accessory"],
    MobType: ["Monster", "NPC", "Shop"],
    Alignment: ["Loyalist", "Neutral", "Rebel", "Aggro"],
    EncounterType: ["PvP", "PvE", "World"],
    EffectType: ["Temporary", "PhysicalDamage", "MagicDamage", "StatusEffect"],
    ResistanceStat: ["None", "Strength", "Agility", "Intelligence"],
    OrderStatus: ["Canceled", "Active", "Fulfilled"],
    TokenType: ["NATIVE", "ERC20", "ERC721", "ERC1155"],
    StatusEffects: [
      "ToHitModifier",
      "DoT",
      "HitPointMod",
      "ArmorMod",
      "WeaponMod",
      "Stun",
    ],
    FragmentType: [
      "None",              // 0
      "TheAwakening",      // 1
      "TheQuartermaster",  // 2
      "TheRestless",       // 3
      "SoulsThatLinger",   // 4
      "TheWound",          // 5
      "DeathOfDeathGod",   // 6
      "BetrayersTruth",    // 7
      "BloodPrice",        // 8
    ],
  },
  tables: {
    /**
     * Global pause state. When true, user-facing game actions are blocked.
     */
    Paused: {
      key: [],
      schema: {
        value: "bool",
      },
    },
    /**
     * Marks an entity as an admin. Used on address entities.
     */
    Admin: {
      key: ["user"],
      schema: {
        user: "address",
        isAdmin: "bool",
      },
    },
    RandomNumbers: {
      key: ["sequenceNumber"],
      schema: {
        sequenceNumber: "uint64",
        requestType: "RngRequestType",
        arbitraryData: "bytes",
      },
    },
    Counters: {
      schema: {
        contractAddress: "address",
        counterId: "uint256",
        counter: "uint256",
      },
      key: ["contractAddress", "counterId"],
    },
    /**
     * Stores players chosen names.
     */
    Name: "string",
    NameExists: {
      key: ["nameData"],
      schema: {
        nameData: "bytes32",
        value: "bool",
      },
    },
    //////////////////////////////////////////////////// CHARACTERS & NPCS ///////////////////////////////////////////////
    Characters: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        tokenId: "uint256",
        owner: "address",
        name: "bytes32",
        locked: "bool",
        originalStats: "bytes",
        baseStats: "bytes",
      },
    },
    CharacterOwner: {
      key: ["owner"],
      schema: {
        owner: "address",
        characterTokenId: "uint256",
        characterId: "bytes32",
      },
    },
    Stats: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        strength: "int256",
        agility: "int256",
        class: "Classes", // Legacy - kept for backward compatibility
        intelligence: "int256",
        maxHp: "int256",
        currentHp: "int256",
        experience: "uint256",
        level: "uint256",
        // New implicit class system fields
        powerSource: "PowerSource",
        race: "Race",
        startingArmor: "ArmorType",
        advancedClass: "AdvancedClass",
        hasSelectedAdvancedClass: "bool",
      },
    },
    // Separate table for class multipliers to avoid stack-too-deep
    ClassMultipliers: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        // Class multipliers (basis points: 1000 = 100%, 1100 = 110%)
        physicalDamageMultiplier: "uint256",
        spellDamageMultiplier: "uint256",
        healingMultiplier: "uint256",
        critDamageMultiplier: "uint256",
        maxHpMultiplier: "uint256",
      },
    },
    SessionTimer: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        lastAction: "uint256",
      },
    },
    Mobs: {
      key: ["mobId"],
      schema: {
        mobId: "uint256",
        mobType: "MobType",
        mobStats: "bytes",
        mobMetadata: "string",
      },
    },
    MobStats: {
      key: ["mobId"],
      schema: {
        mobId: "bytes32",
        armor: "int256",
        isElite: "bool",
        inventory: "uint256[]",
      },
    },
    MobsByLevel: {
      key: ["level"],
      schema: {
        level: "uint256",
        mobIds: "uint256[]",
      },
    },
    Levels: {
      key: ["level"],
      schema: {
        level: "uint256",
        experience: "uint256",
      },
    },
    CharacterEquipment: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        strBonus: "int256",
        agiBonus: "int256",
        intBonus: "int256",
        hpBonus: "int256",
        armor: "int256",
        equippedArmor: "uint256[]",
        equippedWeapons: "uint256[]",
        equippedSpells: "uint256[]",
        equippedConsumables: "uint256[]",
        equippedAccessories: "uint256[]",
      },
    },
    ///////////////////////////////////////// ITEMS ///////////////////////////////////////////////////////
    Items: {
      schema: {
        itemId: "uint256",
        itemType: "ItemType",
        dropChance: "uint256",
        price: "uint256",
        rarity: "uint256",
        stats: "bytes",
      },
      key: ["itemId"],
    },
    StatRestrictions: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        minAgility: "int256",
        minIntelligence: "int256",
        minStrength: "int256",
      },
    },
    WeaponStats: {
      schema: {
        itemId: "uint256",
        agiModifier: "int256",
        intModifier: "int256",
        hpModifier: "int256",
        maxDamage: "int256",
        minDamage: "int256",
        minLevel: "uint256",
        strModifier: "int256",
        effects: "bytes32[]",
      },
      key: ["itemId"],
    },
    WeaponScaling: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        usesAgi: "bool",
      },
    },
    ArmorStats: {
      schema: {
        itemId: "uint256",
        agiModifier: "int256",
        armorModifier: "int256",
        hpModifier: "int256",
        intModifier: "int256",
        minLevel: "uint256",
        strModifier: "int256",
        armorType: "ArmorType",
      },
      key: ["itemId"],
    },
    AccessoryStats: {
      schema: {
        itemId: "uint256",
        agiModifier: "int256",
        armorModifier: "int256",
        hpModifier: "int256",
        intModifier: "int256",
        minLevel: "uint256",
        strModifier: "int256",
        effects: "bytes32[]",
      },
      key: ["itemId"],
    },
    SpellStats: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        minDamage: "int256",
        maxDamage: "int256",
        minLevel: "uint256",
        effects: "bytes32[]",
      },
    },
    ConsumableStats: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        minDamage: "int256",
        maxDamage: "int256",
        minLevel: "uint256",
        effects: "bytes32[]",
      },
    },
    StarterItems: {
      key: ["class"],
      schema: {
        class: "Classes",
        itemIds: "uint256[]",
        amounts: "uint256[]",
      },
    },
    // New starter items table based on armor type for implicit class system
    ArmorStarterItems: {
      key: ["armorType"],
      schema: {
        armorType: "ArmorType",
        itemIds: "uint256[]",
        amounts: "uint256[]",
      },
    },
    // Pool of items available for selection during character creation
    // isStarter flag indicates if the item can be chosen as a starter item
    StarterItemPool: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        isStarter: "bool",
      },
    },
    // Universal starter consumables given to all new characters
    StarterConsumables: {
      key: [],
      schema: {
        itemIds: "uint256[]",
        amounts: "uint256[]",
      },
    },
    // Advanced class items issued at level 10
    AdvancedClassItems: {
      key: ["advancedClass"],
      schema: {
        advancedClass: "AdvancedClass",
        itemIds: "uint256[]",
        amounts: "uint256[]",
      },
    },
    AdventureEscrow: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        balance: "uint256",
      },
    },
    /////////////////////////////////// ACTIONS ////////////////////////////////////////////////////////////////////////////
    // Effects apply damage and or status effects
    Effects: {
      schema: {
        effectId: "bytes32",
        effectType: "EffectType",
        effectExists: "bool",
      },
      key: ["effectId"],
    },
    PhysicalDamageStats: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        armorPenetration: "int256",
        attackModifierBonus: "int256",
        bonusDamage: "int256",
        critChanceBonus: "int256",
      },
    },

    MagicDamageStats: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        attackModifierBonus: "int256",
        bonusDamage: "int256",
        critChanceBonus: "int256",
      },
    },
    StatusEffectStats: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        agiModifier: "int256",
        armorModifier: "int256",
        damagePerTick: "int256",
        hpModifier: "int256",
        intModifier: "int256",
        resistanceStat: "ResistanceStat",
        strModifier: "int256",
      },
    },
    StatusEffectTargeting: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        targetsSelf: "bool",
      },
    },
    StatusEffectValidity: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        cooldown: "uint256",
        maxStacks: "uint256",
        validTime: "uint256",
        validTurns: "uint256",
      },
    },
    ////////////////////////////////// ENCOUNTERS ///////////////////////////////////////////////////////////////////////////////
    CombatEncounter: {
      schema: {
        //keccak hash of (attackers, defenders, encounterType, startTime)
        encounterId: "bytes32",
        encounterType: "EncounterType",
        // the starting timestamp
        start: "uint256",
        // timestamp of when combat ended.  0 if ongoing.
        end: "uint256",
        rewardsDistributed: "bool",
        // the current turn.  starts at 0
        currentTurn: "uint256",
        currentTurnTimer: "uint256",
        // the max number of turns. default is 15 for pve
        maxTurns: "uint256",
        attackersAreMobs: "bool",
        // array of monsterIds if pve playerIds if pvp
        defenders: "bytes32[]",
        // array of playerIds
        attackers: "bytes32[]",
      },
      key: ["encounterId"],
    },
    WorldEncounter: {
      key: ["encounterId"],
      schema: {
        encounterId: "bytes32",
        character: "bytes32",
        entity: "bytes32",
        start: "uint256",
        end: "uint256",
      },
    },
    // when an entity starts combat it creates a "encounter entity" for that encounter.
    //when combat ends, the encounterId is set to zero
    EncounterEntity: {
      key: ["encounterEntityId"],
      schema: {
        encounterEntityId: "bytes32",
        // by default this is bytes(0), if this entity is in an encounter it will be set,
        encounterId: "bytes32",
        died: "bool",
        pvpTimer: "uint256",
        appliedStatusEffects: "bytes32[]",
      },
    },
    WorldStatusEffects: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        appliedStatusEffects: "bytes32[]",
      },
    },
    ///////////////////////////////////// MAP //////////////////////////////////////////////
    MapConfig: {
      key: [],
      schema: {
        height: "uint16",
        width: "uint16",
      },
      codegen: {
        dataStruct: false,
      },
    },
    Spawned: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        spawned: "bool",
      },
    },
    /**
     * The position of an entity.
     */
    Position: {
      key: ["entity"],
      codegen: {
        dataStruct: false,
      },
      schema: {
        entity: "bytes32",
        x: "uint16",
        y: "uint16",
      },
    },
    EntitiesAtPosition: {
      key: ["x", "y"],
      schema: {
        x: "uint16",
        y: "uint16",
        entities: "bytes32[]",
      },
    },
    /**
     * UltimateDominion settings:
     * - locked - If true, game settings are locked.
     * - goldToken that is used in UltimateDominion rewards.
     * - characterToken ERC721 character nft contract.
     * - entropy address of pyth entropy contract
     * - pythProvider address of pyth provider.
     * - marketplace address of Marketplace contract.
     * - lootManager address of LootManager contract.
     */
    UltimateDominionConfig: {
      key: [],
      schema: {
        locked: "bool",
        goldToken: "address",
        characterToken: "address",
        items: "address",
        badgeToken: "address",
        marketplace: "address",
        lootManager: "address",
        shop: "address",
        maxPlayers: "uint256",
        feeRecipient: "address",
        feePercent: "uint256", // Basis points (300 = 3%)
        founderWindowEnd: "uint256", // Timestamp when Founder badge minting ends
        fragmentToken: "address", // ERC721 fragment NFT contract
        // NOTE: globalDropMultiplier and goldDropMultiplier removed — on-chain schema is immutable (13 fields).
        // These need a separate DropConfig table. See SESSION.md pending items.
      },
    },
    ///////////////////////////////////// MARKETPLACE ///////////////////////////////////
    Orders: {
      key: ["orderHash"],
      schema: {
        orderHash: "bytes32",
        offerer: "address",
        offerCounter: "uint256",
        orderStatus: "OrderStatus",
      },
    },
    Considerations: {
      key: ["orderHash"],
      schema: {
        orderHash: "bytes32",
        tokenType: "TokenType",
        token: "address",
        identifier: "uint256",
        amount: "uint256",
        recipient: "address",
      },
    },
    Offers: {
      key: ["orderHash"],
      schema: {
        orderHash: "bytes32",
        tokenType: "TokenType",
        token: "address",
        identifier: "uint256",
        amount: "uint256",
      },
    },
    MarketplaceSale: {
      key: ["orderHash"],
      schema: {
        orderHash: "bytes32",
        buyer: "address",
        itemId: "uint256",
        price: "uint256",
        seller: "address",
        timestamp: "uint256",
      },
      type: "offchainTable",
    },
    ///////////////////////////////////// SHOPS ///////////////////////////////////
    Shops: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        gold: "uint256",
        maxGold: "uint256",
        priceMarkup: "uint256",
        priceMarkdown: "uint256",
        restockTimestamp: "uint256",
        sellableItems: "uint256[]",
        buyableItems: "uint256[]",
        restock: "uint256[]",
        stock: "uint256[]",
      },
    },
    ShopSale: {
      key: ["shopId", "customerId", "itemId", "timestamp"],
      schema: {
        shopId: "bytes32",
        customerId: "bytes32",
        itemId: "uint256",
        timestamp: "uint256",
        buying: "bool",
        price: "uint256",
      },
      type: "offchainTable",
    },

    ////////////////////////////////////////// OFFCHAIN TABLES////////////////////////////////////////
    RngLogs: {
      key: ["requestId"],
      schema: {
        requestId: "uint256",
        sequenceNumber: "uint64",
        requestType: "RngRequestType",
        randomNumber: "uint256",
        userRandomNumber: "bytes32",
        data: "bytes",
      },
      type: "offchainTable",
    },
    ActionOutcome: {
      schema: {
        encounterId: "bytes32",
        currentTurn: "uint256",
        attackNumber: "uint256",
        itemId: "uint256",
        attackerId: "bytes32",
        defenderId: "bytes32",
        attackerDamageDelt: "int256",
        defenderDamageDelt: "int256",
        attackerDied: "bool",
        defenderDied: "bool",
        blockNumber: "uint256",
        timestamp: "uint256",
        damagePerHit: "int256[]",
        effectIds: "bytes32[]",
        hit: "bool[]",
        miss: "bool[]",
        crit: "bool[]",
      },
      key: ["encounterId", "currentTurn", "attackNumber"],
      type: "offchainTable",
    },
    DamageOverTimeApplied: {
      key: ["encounterId", "turnNumber"],
      schema: {
        encounterId: "bytes32",
        turnNumber: "uint256",
        entityId: "bytes32",
        totalDamage: "int256",
        individualDamages: "int256[]",
      },
    },
    CombatOutcome: {
      schema: {
        encounterId: "bytes32",
        endTime: "uint256",
        attackersWin: "bool",
        playerFled: "bool",
        expDropped: "uint256",
        goldDropped: "uint256",
        itemsDropped: "uint256[]",
      },
      key: ["encounterId"],
      type: "offchainTable",
    },
    ///////////////////////////////////// DELEGATION CONTROL ///////////////////////////////////
    /**
     * Whitelist of game systems allowed through GameDelegationControl.
     * Only systems in this table can be called via delegated burner wallets.
     */
    AllowedGameSystems: {
      key: ["systemId"],
      schema: {
        systemId: "ResourceId",
        allowed: "bool",
      },
    },
    ///////////////////////////////////// GAS STATION ///////////////////////////////////
    /**
     * Singleton config for the GasStation system.
     * ethPerGold: exchange rate (wei per 1e18 gold units)
     * maxGoldPerSwap: max gold burnable in one swap
     * cooldownSeconds: minimum time between swaps per player
     * enabled: pause flag for gas station specifically
     */
    GasStationConfig: {
      key: [],
      schema: {
        ethPerGold: "uint256",
        maxGoldPerSwap: "uint256",
        cooldownSeconds: "uint256",
        enabled: "bool",
      },
    },
    /**
     * Per-player cooldown tracking for GasStation swaps.
     */
    GasStationCooldown: {
      key: ["player"],
      schema: {
        player: "address",
        lastSwap: "uint256",
      },
    },
    /**
     * Singleton config for GasStation Uniswap V3 swap integration.
     * Separate from GasStationConfig to avoid schema migration.
     */
    GasStationSwapConfig: {
      key: [],
      schema: {
        swapRouter: "address",       // Uniswap V3 SwapRouter02
        weth: "address",             // WETH on Base (0x4200...0006)
        poolFee: "uint24",           // Pool fee tier (10000 = 1%)
        relayerAddress: "address",   // Self-hosted relayer EOA
        goldPerGasCharge: "uint256", // Gold charged per relayer tx
      },
    },
    ///////////////////////////////////// FRAGMENTS (Lore NFTs) ///////////////////////////////////
    // Track trigger progress and claims per character
    FragmentProgress: {
      key: ["characterId", "fragmentType"],
      schema: {
        characterId: "bytes32",
        fragmentType: "FragmentType",
        triggered: "bool",
        triggeredAt: "uint256",
        triggerTileX: "uint16",
        triggerTileY: "uint16",
        claimed: "bool",
        claimedAt: "uint256",
        tokenId: "uint256",
      },
    },
    // Track first-time actions for triggers
    CharacterFirstActions: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        hasKilledMonster: "bool",
        hasKilledPlayer: "bool",
      },
    },
    // Fragment metadata (set once by admin)
    FragmentMetadata: {
      key: ["fragmentType"],
      schema: {
        fragmentType: "FragmentType",
        name: "string",
        narrative: "string",
        hint: "string",
      },
    },
    ///////////////////////////////////// ZONE CONQUEROR ///////////////////////////////////
    // Tracks which characters completed a zone and when (ordered list)
    ZoneCompletions: {
      key: ["zoneId"],
      schema: {
        zoneId: "uint256",
        completedCharacters: "bytes32[]",
        completedTimestamps: "uint256[]",
      },
    },
    // Per-character per-zone completion status (fast lookup)
    CharacterZoneCompletion: {
      key: ["characterId", "zoneId"],
      schema: {
        characterId: "bytes32",
        zoneId: "uint256",
        completed: "bool",
        completedAt: "uint256",
        rank: "uint256",
      },
    },
    // Zone configuration (max level per zone, set by admin)
    ZoneConfig: {
      key: ["zoneId"],
      schema: {
        zoneId: "uint256",
        maxLevel: "uint256",
        badgeBase: "uint256",
      },
    },
  },
  excludeSystems: ["RngSystem"],
});
