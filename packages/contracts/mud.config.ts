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
    GuildRank: [
      "None",     // 0
      "Member",   // 1
      "Officer",  // 2
      "Leader",   // 3
    ],
    BoostType: [
      "None",       // 0
      "DropRate",   // 1
      "Experience", // 2
      "GoldFind",   // 3
    ],
    SocialLinkType: [
      "None",    // 0
      "Friend",  // 1
      "Rival",   // 2
      "Blocked", // 3
    ],
    TradeStatus: [
      "None",      // 0
      "Pending",   // 1
      "Accepted",  // 2
      "Cancelled", // 3
      "Expired",   // 4
    ],
    QuestStatus: [
      "None",      // 0
      "Available", // 1
      "Active",    // 2
      "Completed", // 3
      "Failed",    // 4
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
        hasBossAI: "bool",
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
    SpellScaling: {
      key: ["effectId"],
      schema: {
        effectId: "bytes32",
        scalingStat: "ResistanceStat",
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
    ItemDurability: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        maxDurability: "uint256",
        currentDurability: "uint256",
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
    /**
     * Session & queue configuration — separate from UltimateDominionConfig
     * because the main config table's on-chain schema is immutable at 13 fields.
     */
    SessionConfig: {
      key: [],
      schema: {
        sessionTimeout: "uint256", // Seconds before idle players are removed (default: 300)
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
    // Track how many times a character has rolled stats (capped at MAX_STAT_ROLLS)
    StatRollCount: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        rollCount: "uint32",
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
    ///////////////////////////////////// GUILDS ///////////////////////////////////
    Guild: {
      key: ["guildId"],
      schema: {
        guildId: "uint256",
        leader: "bytes32",       // characterId of guild leader
        taxRate: "uint256",      // basis points (0–5000 = 0–50%)
        treasury: "uint256",     // gold held by guild
        memberCount: "uint256",
        isOpen: "bool",          // open = anyone can join, closed = invite only
        createdAt: "uint256",
        lifetimeGoldEarned: "uint256", // total gold ever taxed, for lore fragment triggers
        name: "string",          // dynamic fields must come last
        tag: "string",           // 2-5 char tag displayed next to member names
      },
    },
    GuildMember: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        guildId: "uint256",
        rank: "GuildRank",
        joinedAt: "uint256",
        lastActive: "uint256",       // for auto-succession logic (14-day inactivity)
        seasonJoinedAt: "uint256",   // must be in guild 75% of season for rewards
      },
    },
    ///////////////////////////////////// CRAFTING ///////////////////////////////////
    CraftingRecipe: {
      key: ["recipeId"],
      schema: {
        recipeId: "uint256",
        resultItemId: "uint256",
        resultAmount: "uint256",
        goldCost: "uint256",
        requiredItems: "uint256[]",
        requiredAmounts: "uint256[]",
      },
    },
    ///////////////////////////////////// BOOSTS & COOLDOWNS ///////////////////////////////////
    // Temporary buffs from shrines, consumables, etc.
    ActiveBoost: {
      key: ["characterId", "boostType"],
      schema: {
        characterId: "bytes32",
        boostType: "BoostType",
        multiplier: "uint256",   // basis points (15000 = 1.5x)
        expiresAt: "uint256",    // block timestamp
      },
    },
    // Generic cooldown table for any entity + any action
    Cooldown: {
      key: ["entityId", "actionId"],
      schema: {
        entityId: "bytes32",
        actionId: "bytes32",     // keccak256 of action name
        readyAt: "uint256",
      },
    },
    // Anti-flip: tracks when a buyer can relist an item on marketplace
    ListingCooldown: {
      key: ["owner", "itemId"],
      schema: {
        owner: "bytes32",        // characterId of the buyer
        itemId: "uint256",
        relistableAt: "uint256",
      },
    },
    ///////////////////////////////////// TITLES ///////////////////////////////////
    TitleDefinition: {
      key: ["titleId"],
      schema: {
        titleId: "uint256",
        name: "string",
      },
    },
    // Which titles a character has unlocked
    TitleUnlocked: {
      key: ["characterId", "titleId"],
      schema: {
        characterId: "bytes32",
        titleId: "uint256",
        unlockedAt: "uint256",
      },
    },
    // Which title a character is currently displaying
    ActiveTitle: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        titleId: "uint256",
      },
    },
    ///////////////////////////////////// REPUTATION & FACTIONS ///////////////////////////////////
    Faction: {
      key: ["factionId"],
      schema: {
        factionId: "uint256",
        name: "string",
      },
    },
    PlayerReputation: {
      key: ["characterId", "factionId"],
      schema: {
        characterId: "bytes32",
        factionId: "uint256",
        reputation: "int256",    // can go negative (hostile)
      },
    },
    ///////////////////////////////////// PLAYER STATS (Leaderboards) ///////////////////////////////////
    // Lifetime aggregate stats per character — used for rankings
    PlayerLifetimeStats: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        totalKills: "uint256",
        totalDeaths: "uint256",
        pvpKills: "uint256",
        pvpDeaths: "uint256",
        goldEarned: "uint256",
        goldSpent: "uint256",
      },
    },
    ///////////////////////////////////// PVP RANKINGS ///////////////////////////////////
    PvpRating: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        rating: "int256",        // ELO/MMR — starts at 1000
        wins: "uint256",
        losses: "uint256",
        season: "uint256",
      },
    },
    PvpSeason: {
      key: [],
      schema: {
        currentSeason: "uint256",
        seasonStart: "uint256",
        seasonEnd: "uint256",
      },
    },
    // Archived final rating at end of each season
    PvpRatingHistory: {
      key: ["characterId", "seasonId"],
      schema: {
        characterId: "bytes32",
        seasonId: "uint256",
        finalRating: "int256",
        wins: "uint256",
        losses: "uint256",
      },
    },
    ///////////////////////////////////// SOCIAL ///////////////////////////////////
    SocialLink: {
      key: ["characterId", "targetId"],
      schema: {
        characterId: "bytes32",
        targetId: "bytes32",
        linkType: "SocialLinkType",
        createdAt: "uint256",
      },
    },
    ///////////////////////////////////// MAIL ///////////////////////////////////
    Mail: {
      key: ["mailId"],
      schema: {
        mailId: "uint256",
        sender: "bytes32",       // characterId
        recipient: "bytes32",    // characterId
        goldAmount: "uint256",
        itemId: "uint256",
        itemAmount: "uint256",
        sentAt: "uint256",
        claimed: "bool",
        message: "string",       // dynamic field must come last
      },
    },
    ///////////////////////////////////// BANK STORAGE ///////////////////////////////////
    // Extra inventory beyond equipped items
    BankSlot: {
      key: ["characterId", "itemId"],
      schema: {
        characterId: "bytes32",
        itemId: "uint256",
        amount: "uint256",
      },
    },
    ///////////////////////////////////// BOUNTIES / DAILY QUESTS ///////////////////////////////////
    Bounty: {
      key: ["bountyId"],
      schema: {
        bountyId: "uint256",
        targetMobId: "uint256",
        requiredKills: "uint256",
        goldReward: "uint256",
        xpReward: "uint256",
        active: "bool",
      },
    },
    BountyProgress: {
      key: ["characterId", "bountyId"],
      schema: {
        characterId: "bytes32",
        bountyId: "uint256",
        killCount: "uint256",
        completed: "bool",
        claimedAt: "uint256",
      },
    },
    // Tracks daily reset for repeatable content
    DailyReset: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        lastResetAt: "uint256",
      },
    },
    ///////////////////////////////////// ENCHANTMENTS ///////////////////////////////////
    EnchantmentDefinition: {
      key: ["enchantmentId"],
      schema: {
        enchantmentId: "uint256",
        name: "string",
        effects: "bytes32[]",
      },
    },
    // Enchantment applied to a specific item instance
    ItemEnchantment: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        enchantmentId: "uint256",
        tier: "uint256",
      },
    },
    ///////////////////////////////////// TALENTS ///////////////////////////////////
    TalentPoints: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        availablePoints: "uint256",
        totalEarned: "uint256",
      },
    },
    TalentChoice: {
      key: ["characterId", "talentId"],
      schema: {
        characterId: "bytes32",
        talentId: "uint256",
        level: "uint256",        // points invested in this talent
      },
    },
    ///////////////////////////////////// DEATH PENALTY ///////////////////////////////////
    DeathPenaltyConfig: {
      key: [],
      schema: {
        goldLossPercent: "uint256",  // basis points (1000 = 10%)
        enabled: "bool",
      },
    },
    ///////////////////////////////////// PARTIES ///////////////////////////////////
    Party: {
      key: ["partyId"],
      schema: {
        partyId: "uint256",
        leader: "bytes32",       // characterId
        maxSize: "uint256",
        createdAt: "uint256",
      },
    },
    PartyMember: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        partyId: "uint256",
        joinedAt: "uint256",
      },
    },
    ///////////////////////////////////// WORLD BOSSES / RAIDS ///////////////////////////////////
    WorldBoss: {
      key: ["bossId"],
      schema: {
        bossId: "uint256",
        mobId: "uint256",        // references Mobs table for stats
        currentHp: "int256",
        maxHp: "int256",
        spawnX: "uint16",
        spawnY: "uint16",
        spawnedAt: "uint256",
        active: "bool",
        goldReward: "uint256",
        xpReward: "uint256",
      },
    },
    // Tracks each player's contribution to a boss fight for proportional rewards
    WorldBossContribution: {
      key: ["bossId", "characterId"],
      schema: {
        bossId: "uint256",
        characterId: "bytes32",
        damageDealt: "uint256",
      },
    },
    ///////////////////////////////////// WORLD EVENTS / SEASONS ///////////////////////////////////
    // Global events — double XP weekends, invasions, seasonal competitions
    WorldEvent: {
      key: ["eventId"],
      schema: {
        eventId: "uint256",
        eventType: "uint256",    // uint256 for flexibility (types TBD)
        startAt: "uint256",
        endAt: "uint256",
        active: "bool",
        name: "string",          // dynamic field last
      },
    },
    EventParticipation: {
      key: ["eventId", "characterId"],
      schema: {
        eventId: "uint256",
        characterId: "bytes32",
        score: "uint256",
        completed: "bool",
      },
    },
    ///////////////////////////////////// MAP EVENTS ///////////////////////////////////
    // Individual events that pop up on the map — treasure chests, wandering merchants,
    // mini-bosses, portals, ambushes, resource nodes, etc.
    MapEvent: {
      key: ["mapEventId"],
      schema: {
        mapEventId: "uint256",
        eventType: "uint256",    // uint256 for flexibility (treasure, merchant, ambush, etc.)
        x: "uint16",
        y: "uint16",
        spawnedAt: "uint256",
        expiresAt: "uint256",    // 0 = no expiry
        active: "bool",
        goldReward: "uint256",
        xpReward: "uint256",
        itemReward: "uint256",   // itemId, 0 = no item
        data: "bytes",           // dynamic field last — flexible payload per event type
      },
    },
    // Tracks which players interacted with a map event
    MapEventParticipation: {
      key: ["mapEventId", "characterId"],
      schema: {
        mapEventId: "uint256",
        characterId: "bytes32",
        completedAt: "uint256",
        rewarded: "bool",
      },
    },
    ///////////////////////////////////// DIRECT TRADING ///////////////////////////////////
    TradeSession: {
      key: ["tradeId"],
      schema: {
        tradeId: "uint256",
        initiator: "bytes32",    // characterId
        target: "bytes32",       // characterId
        status: "TradeStatus",
        createdAt: "uint256",
      },
    },
    // Each side can offer up to N item slots + gold
    TradeOffer: {
      key: ["tradeId", "slot"],
      schema: {
        tradeId: "uint256",
        slot: "uint256",
        offeredBy: "bytes32",    // characterId
        itemId: "uint256",
        amount: "uint256",
        goldAmount: "uint256",
      },
    },
    ///////////////////////////////////// ACHIEVEMENTS ///////////////////////////////////
    AchievementDefinition: {
      key: ["achievementId"],
      schema: {
        achievementId: "uint256",
        points: "uint256",
        name: "string",          // dynamic field last
      },
    },
    AchievementUnlocked: {
      key: ["characterId", "achievementId"],
      schema: {
        characterId: "bytes32",
        achievementId: "uint256",
        unlockedAt: "uint256",
      },
    },
    ///////////////////////////////////// QUESTS ///////////////////////////////////
    Quest: {
      key: ["questId"],
      schema: {
        questId: "uint256",
        prereqQuestId: "uint256", // 0 = no prereq
        xpReward: "uint256",
        goldReward: "uint256",
        itemReward: "uint256",    // itemId, 0 = no item
        repeatable: "bool",
        name: "string",           // dynamic field last
      },
    },
    QuestProgress: {
      key: ["characterId", "questId"],
      schema: {
        characterId: "bytes32",
        questId: "uint256",
        status: "QuestStatus",
        startedAt: "uint256",
        completedAt: "uint256",
      },
    },
    // Individual objectives within a quest (kill X, collect Y, visit Z)
    QuestObjective: {
      key: ["questId", "objectiveId"],
      schema: {
        questId: "uint256",
        objectiveId: "uint256",
        targetType: "uint256",    // uint256 for flexibility (kill, collect, visit, etc.)
        targetId: "uint256",      // mobId, itemId, tileId, etc.
        requiredCount: "uint256",
      },
    },
    QuestObjectiveProgress: {
      key: ["characterId", "questId", "objectiveId"],
      schema: {
        characterId: "bytes32",
        questId: "uint256",
        objectiveId: "uint256",
        currentCount: "uint256",
      },
    },
    ///////////////////////////////////// PETS / COMPANIONS ///////////////////////////////////
    Pet: {
      key: ["petId"],
      schema: {
        petId: "uint256",
        owner: "bytes32",        // characterId
        petType: "uint256",      // uint256 for flexibility (types TBD)
        level: "uint256",
        xp: "uint256",
        name: "string",          // dynamic field last
      },
    },
    PetEquipped: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        petId: "uint256",
      },
    },
    ///////////////////////////////////// TERRITORY / GUILD WARS ///////////////////////////////////
    Territory: {
      key: ["tileX", "tileY"],
      schema: {
        tileX: "uint16",
        tileY: "uint16",
        ownerGuildId: "uint256",
        claimedAt: "uint256",
        contested: "bool",
        contestingGuildId: "uint256",
        contestStartedAt: "uint256",
      },
    },
    GuildWar: {
      key: ["warId"],
      schema: {
        warId: "uint256",
        attackerGuildId: "uint256",
        defenderGuildId: "uint256",
        startedAt: "uint256",
        endedAt: "uint256",
        kills1: "uint256",      // attacker kill count
        kills2: "uint256",      // defender kill count
        resolved: "bool",
        winnerId: "uint256",    // guildId of winner, 0 = ongoing/draw
      },
    },
    // Bonuses granted to guild members when guild owns territory
    // e.g., +10% XP in owned tiles, +5% gold find, etc.
    TerritoryBonus: {
      key: ["tileX", "tileY"],
      schema: {
        tileX: "uint16",
        tileY: "uint16",
        xpBonusBps: "uint256",      // basis points (1000 = 10%)
        goldBonusBps: "uint256",
        dropRateBonusBps: "uint256",
      },
    },
    // Guild-wide buffs purchased/activated by guild leader from treasury
    // e.g., +5% XP for all members for 24h, costs 200 gold from treasury
    GuildBuff: {
      key: ["guildId", "boostType"],
      schema: {
        guildId: "uint256",
        boostType: "BoostType",
        multiplierBps: "uint256",    // basis points bonus (500 = 5%)
        expiresAt: "uint256",
        activatedBy: "bytes32",      // characterId of leader/officer who activated
      },
    },
    // Configurable gold tax — guild leader sets % of member gold earnings sent to treasury
    // Weekly cooperative objectives — leader picks 1 of 3 random contracts
    GuildContract: {
      key: ["guildId", "weekId"],
      schema: {
        guildId: "uint256",
        weekId: "uint256",
        contractType: "uint256",     // type of objective (kill, collect, trade, etc.)
        target: "uint256",           // target count to complete
        progress: "uint256",         // current progress
        completed: "bool",
        rewardClaimed: "bool",
      },
    },
    // Seasonal competition scoring — 12-week seasons
    GuildSeason: {
      key: ["seasonId", "guildId"],
      schema: {
        seasonId: "uint256",
        guildId: "uint256",
        points: "uint256",
        pveKills: "uint256",
        pvpWins: "uint256",
        tilesHeldAtEnd: "uint256",
        warsWon: "uint256",
        contractsCompleted: "uint256",
      },
    },
    // Regear fund — member requests treasury gold after PvP death
    RegearRequest: {
      key: ["requestId"],
      schema: {
        requestId: "uint256",
        guildId: "uint256",
        requester: "bytes32",        // characterId
        goldRequested: "uint256",
        approved: "bool",
        approvedBy: "bytes32",       // characterId of leader/officer
        paidOut: "bool",
        requestedAt: "uint256",
      },
    },
    ///////////////////////////////////// CHARACTER ABILITIES ///////////////////////////////////
    AbilityDefinition: {
      key: ["abilityId"],
      schema: {
        abilityId: "uint256",
        cooldownSeconds: "uint256",
        manaCost: "uint256",
        minLevel: "uint256",
        name: "string",          // dynamic field last
        effects: "bytes32[]",    // dynamic field last
      },
    },
    CharacterAbility: {
      key: ["characterId", "abilityId"],
      schema: {
        characterId: "bytes32",
        abilityId: "uint256",
        level: "uint256",
        lastUsed: "uint256",
      },
    },
    ///////////////////////////////////// PRICE HISTORY (offchain) ///////////////////////////////////
    PriceHistory: {
      key: ["itemId", "timestamp"],
      schema: {
        itemId: "uint256",
        timestamp: "uint256",
        avgPrice: "uint256",
        volume: "uint256",
      },
      type: "offchainTable",
    },
    ///////////////////////////////////// ITEM PROVENANCE & HISTORY ///////////////////////////////////
    // Permanently records who crafted/forged an item
    ItemProvenance: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        crafter: "bytes32",          // characterId who forged it (0 = monster drop)
        forgedAt: "uint256",
        method: "uint256",           // how it was created (drop, craft, quest reward, etc.)
      },
    },
    // Full ownership/event chain — items accumulate story over time
    ItemEvent: {
      key: ["itemId", "eventIndex"],
      schema: {
        itemId: "uint256",
        eventIndex: "uint256",
        eventType: "uint256",        // traded, dropped, looted, equipped, enchanted, etc.
        fromEntity: "bytes32",       // characterId or 0 (world/monster)
        toEntity: "bytes32",         // characterId or 0
        timestamp: "uint256",
        goldValue: "uint256",        // price if traded, 0 otherwise
      },
    },
    ///////////////////////////////////// PLAYER BOUNTIES ///////////////////////////////////
    // Trustless assassination contracts — gold escrowed in contract
    PlayerBounty: {
      key: ["bountyId"],
      schema: {
        bountyId: "uint256",
        placer: "bytes32",           // characterId who placed the bounty
        target: "bytes32",           // characterId of the target
        goldReward: "uint256",       // escrowed gold amount
        claimedBy: "bytes32",       // characterId who killed the target (0 = unclaimed)
        active: "bool",
        placedAt: "uint256",
        claimedAt: "uint256",
      },
    },
    ///////////////////////////////////// PLAYER CONTRACTS ///////////////////////////////////
    // Player-created quests with escrowed gold rewards
    PlayerContract: {
      key: ["contractId"],
      schema: {
        contractId: "uint256",
        creator: "bytes32",          // characterId
        goldReward: "uint256",       // escrowed
        fulfilled: "bool",
        fulfilledBy: "bytes32",      // characterId
        createdAt: "uint256",
        expiresAt: "uint256",        // 0 = no expiry
        description: "string",       // dynamic field last
      },
    },
    // Requirements for a player contract (bring X of item Y, kill Z monsters, etc.)
    ContractRequirement: {
      key: ["contractId", "requirementIndex"],
      schema: {
        contractId: "uint256",
        requirementIndex: "uint256",
        requirementType: "uint256",  // item delivery, kill count, visit tile, etc.
        targetId: "uint256",         // itemId, mobId, etc.
        requiredAmount: "uint256",
        currentAmount: "uint256",
      },
    },
    ///////////////////////////////////// OATHS / BLOOD PACTS ///////////////////////////////////
    // Sworn player-to-player commitments — breaking has permanent consequences
    Oath: {
      key: ["oathId"],
      schema: {
        oathId: "uint256",
        player1: "bytes32",          // characterId
        player2: "bytes32",          // characterId
        oathType: "uint256",         // non-aggression, alliance, duel pact, etc.
        createdAt: "uint256",
        broken: "bool",
        brokenBy: "bytes32",         // characterId of the oathbreaker
        brokenAt: "uint256",
      },
    },
    ///////////////////////////////////// TIME-LOCKED VAULTS ///////////////////////////////////
    // Provable scarcity — lock items/gold until a specific timestamp
    TimeVault: {
      key: ["vaultId"],
      schema: {
        vaultId: "uint256",
        owner: "bytes32",            // characterId
        unlockAt: "uint256",         // block timestamp when vault can be opened
        goldAmount: "uint256",
        itemId: "uint256",           // 0 = gold only
        itemAmount: "uint256",
        locked: "bool",
        createdAt: "uint256",
      },
    },
    ///////////////////////////////////// GRAVESITES ///////////////////////////////////
    // Permanent death markers on the map — the world remembers
    Gravesite: {
      key: ["gravesiteId"],
      schema: {
        gravesiteId: "uint256",
        x: "uint16",
        y: "uint16",
        characterId: "bytes32",      // who died
        killedBy: "bytes32",         // characterId or mobId
        diedAt: "uint256",
        isPvp: "bool",
      },
    },
    ///////////////////////////////////// INSCRIPTIONS ///////////////////////////////////
    // Permanent player marks on the world — first-to-arrive, memorials, graffiti
    Inscription: {
      key: ["inscriptionId"],
      schema: {
        inscriptionId: "uint256",
        x: "uint16",
        y: "uint16",
        author: "bytes32",          // characterId
        createdAt: "uint256",
        message: "string",          // dynamic field last
      },
    },
    ///////////////////////////////////// RUNE SOCKETS ///////////////////////////////////
    // Runes are separate tokens that socket into items for composable modification
    RuneDefinition: {
      key: ["runeId"],
      schema: {
        runeId: "uint256",
        rarity: "uint256",
        name: "string",             // dynamic fields last
        effects: "bytes32[]",
      },
    },
    // Which rune is socketed into which item slot
    ItemSocket: {
      key: ["itemId", "socketIndex"],
      schema: {
        itemId: "uint256",
        socketIndex: "uint256",
        runeId: "uint256",           // 0 = empty socket
      },
    },
    ///////////////////////////////////// WILLS / INHERITANCE ///////////////////////////////////
    // Trustless transfer of assets after prolonged inactivity
    CharacterWill: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        beneficiary: "bytes32",      // characterId who inherits
        inactivityDays: "uint256",   // days of inactivity before will executes
        executed: "bool",
        executedAt: "uint256",
      },
    },
    ///////////////////////////////////// CHARACTER LEGACY ///////////////////////////////////
    // Permanent record when a character dies or is retired
    CharacterLegacy: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        diedAt: "uint256",           // 0 = still alive
        killedBy: "bytes32",         // characterId or mobId
        totalKills: "uint256",
        totalDeaths: "uint256",
        goldEarned: "uint256",
        playTime: "uint256",         // total seconds played
      },
    },
    ///////////////////////////////////// BUY ORDERS (Two-Sided Marketplace) ///////////////////////////////////
    // Players post "I want X of item Y at Z gold each" with escrowed gold
    BuyOrder: {
      key: ["orderId"],
      schema: {
        orderId: "uint256",
        buyer: "bytes32",            // characterId
        itemId: "uint256",
        pricePerUnit: "uint256",
        quantity: "uint256",
        filled: "uint256",
        goldEscrowed: "uint256",
        active: "bool",
        createdAt: "uint256",
        expiresAt: "uint256",        // 0 = no expiry
      },
    },
    ///////////////////////////////////// PLAYER VENDOR STALLS ///////////////////////////////////
    // Persistent player shops on the map — sell items while offline
    PlayerVendor: {
      key: ["vendorId"],
      schema: {
        vendorId: "uint256",
        owner: "bytes32",            // characterId
        x: "uint16",
        y: "uint16",
        active: "bool",
        createdAt: "uint256",
        maintenancePaidUntil: "uint256", // gold sink: daily upkeep
        name: "string",             // dynamic field last
      },
    },
    VendorListing: {
      key: ["vendorId", "slot"],
      schema: {
        vendorId: "uint256",
        slot: "uint256",
        itemId: "uint256",
        amount: "uint256",
        pricePerUnit: "uint256",
      },
    },
    VendorSale: {
      key: ["vendorId", "saleIndex"],
      schema: {
        vendorId: "uint256",
        saleIndex: "uint256",
        buyer: "bytes32",
        itemId: "uint256",
        amount: "uint256",
        totalPrice: "uint256",
        timestamp: "uint256",
      },
      type: "offchainTable",
    },
    ///////////////////////////////////// LIFE SKILLS / GATHERING ///////////////////////////////////
    LifeSkillDefinition: {
      key: ["skillId"],
      schema: {
        skillId: "uint256",
        maxLevel: "uint256",
        name: "string",             // dynamic field last
      },
    },
    CharacterLifeSkill: {
      key: ["characterId", "skillId"],
      schema: {
        characterId: "bytes32",
        skillId: "uint256",
        level: "uint256",
        xp: "uint256",
      },
    },
    ResourceNode: {
      key: ["nodeId"],
      schema: {
        nodeId: "uint256",
        x: "uint16",
        y: "uint16",
        resourceItemId: "uint256",   // what it yields
        requiredSkillId: "uint256",
        requiredLevel: "uint256",
        respawnSeconds: "uint256",
        lastHarvestedAt: "uint256",
        depleted: "bool",
      },
    },
    // Links crafting recipes to life skill requirements
    CraftingSkillRequirement: {
      key: ["recipeId"],
      schema: {
        recipeId: "uint256",
        requiredSkillId: "uint256",
        requiredLevel: "uint256",
        xpReward: "uint256",         // life skill XP from crafting
      },
    },
    ///////////////////////////////////// PLAYER HOUSING ///////////////////////////////////
    HousingPlot: {
      key: ["plotId"],
      schema: {
        plotId: "uint256",
        x: "uint16",
        y: "uint16",
        owner: "bytes32",            // characterId (0 = unclaimed)
        tier: "uint256",
        claimedAt: "uint256",
        lastMaintenancePaid: "uint256",
        maintenanceCostPerDay: "uint256", // gold sink
      },
    },
    HousingFurniture: {
      key: ["plotId", "slot"],
      schema: {
        plotId: "uint256",
        slot: "uint256",
        furnitureItemId: "uint256",
        bonusType: "uint256",        // 0 = cosmetic only
        bonusValue: "uint256",
      },
    },
    ///////////////////////////////////// MOUNTS ///////////////////////////////////
    MountDefinition: {
      key: ["mountTypeId"],
      schema: {
        mountTypeId: "uint256",
        speedBonus: "uint256",       // basis points
        rarity: "uint256",
        name: "string",             // dynamic field last
      },
    },
    CharacterMount: {
      key: ["mountId"],
      schema: {
        mountId: "uint256",
        owner: "bytes32",            // characterId
        mountTypeId: "uint256",
        level: "uint256",
        xp: "uint256",
        name: "string",             // dynamic field last
      },
    },
    MountEquipped: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        mountId: "uint256",          // 0 = no mount
      },
    },
    MountLineage: {
      key: ["mountId"],
      schema: {
        mountId: "uint256",
        parent1: "uint256",          // mountId (0 = wild-caught)
        parent2: "uint256",
        generation: "uint256",
        bornAt: "uint256",
      },
    },
    ///////////////////////////////////// TRANSMOG / APPEARANCE ///////////////////////////////////
    AppearanceUnlocked: {
      key: ["characterId", "itemId"],
      schema: {
        characterId: "bytes32",
        itemId: "uint256",
        unlockedAt: "uint256",
      },
    },
    TransmogSlot: {
      key: ["characterId", "slot"],
      schema: {
        characterId: "bytes32",
        slot: "uint256",             // equipment slot (head, chest, weapon, etc.)
        appearanceItemId: "uint256", // 0 = show real gear
      },
    },
    DyeColor: {
      key: ["characterId", "slot", "channel"],
      schema: {
        characterId: "bytes32",
        slot: "uint256",
        channel: "uint256",          // dye channel within equipment piece
        colorId: "uint256",
      },
    },
    ///////////////////////////////////// BESTIARY / COLLECTION LOG ///////////////////////////////////
    BestiaryEntry: {
      key: ["characterId", "mobId"],
      schema: {
        characterId: "bytes32",
        mobId: "uint256",
        killCount: "uint256",
        firstKilledAt: "uint256",
        knowledgeRank: "uint256",    // higher rank = small damage bonus vs this mob
      },
    },
    DiscoveryLog: {
      key: ["characterId", "discoveryType", "discoveryId"],
      schema: {
        characterId: "bytes32",
        discoveryType: "uint256",    // monster, item, location, NPC, recipe
        discoveryId: "uint256",      // mobId, itemId, tileId, etc.
        discoveredAt: "uint256",
      },
    },
    CollectionProgress: {
      key: ["characterId", "categoryId"],
      schema: {
        characterId: "bytes32",
        categoryId: "uint256",       // bestiary, items, locations, etc.
        discovered: "uint256",
        total: "uint256",
      },
    },
    ///////////////////////////////////// MENTORING ///////////////////////////////////
    Mentorship: {
      key: ["mentorshipId"],
      schema: {
        mentorshipId: "uint256",
        mentor: "bytes32",           // characterId
        apprentice: "bytes32",       // characterId
        startedAt: "uint256",
        completedAt: "uint256",      // 0 = ongoing
        apprenticeLevelAtStart: "uint256",
        apprenticeLevelAtEnd: "uint256",
        active: "bool",
      },
    },
    MentorStats: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        totalMentored: "uint256",
        activeMentees: "uint256",
        mentorRank: "uint256",
      },
    },
    ///////////////////////////////////// INSURANCE ///////////////////////////////////
    InsurancePolicy: {
      key: ["policyId"],
      schema: {
        policyId: "uint256",
        owner: "bytes32",            // characterId
        itemId: "uint256",
        premiumPaid: "uint256",
        payoutAmount: "uint256",
        payoutPercentBps: "uint256",
        expiresAt: "uint256",
        claimed: "bool",
        active: "bool",
      },
    },
    InsuranceConfig: {
      key: [],
      schema: {
        basePremiumRateBps: "uint256",
        maxPayoutPercentBps: "uint256",
        enabled: "bool",
      },
    },
    ///////////////////////////////////// WORKERS / OFFLINE PROGRESSION ///////////////////////////////////
    Worker: {
      key: ["workerId"],
      schema: {
        workerId: "uint256",
        owner: "bytes32",            // characterId
        workerType: "uint256",       // miner, herbalist, craftsman, etc.
        tier: "uint256",
        level: "uint256",
        xp: "uint256",
        hiredAt: "uint256",
        name: "string",             // dynamic field last
      },
    },
    WorkerAssignment: {
      key: ["workerId"],
      schema: {
        workerId: "uint256",
        taskType: "uint256",         // gather, craft, sell
        targetId: "uint256",         // nodeId, recipeId, etc.
        startedAt: "uint256",
        completesAt: "uint256",
        claimed: "bool",
        resultItemId: "uint256",
        resultAmount: "uint256",
      },
    },
    WorkerCapacity: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        maxWorkers: "uint256",
        activeWorkers: "uint256",
      },
    },
    ///////////////////////////////////// BLUEPRINTS / RECIPE DISCOVERY ///////////////////////////////////
    BlueprintDefinition: {
      key: ["blueprintId"],
      schema: {
        blueprintId: "uint256",
        recipeId: "uint256",
        isOriginal: "bool",          // true = infinite use, false = consumable copy
        maxUses: "uint256",          // for copies (0 = infinite for originals)
        rarity: "uint256",
      },
    },
    CharacterBlueprint: {
      key: ["characterId", "blueprintId"],
      schema: {
        characterId: "bytes32",
        blueprintId: "uint256",
        usesRemaining: "uint256",
        discoveredAt: "uint256",
      },
    },
    ///////////////////////////////////// COURIER / HAULING CONTRACTS ///////////////////////////////////
    // Transport items from A to B — hauler puts up collateral
    CourierContract: {
      key: ["courierId"],
      schema: {
        courierId: "uint256",
        creator: "bytes32",          // characterId
        hauler: "bytes32",           // characterId (0 = open)
        pickupX: "uint16",
        pickupY: "uint16",
        deliveryX: "uint16",
        deliveryY: "uint16",
        reward: "uint256",
        collateral: "uint256",       // hauler escrow
        createdAt: "uint256",
        expiresAt: "uint256",
        completedAt: "uint256",
        failed: "bool",
        active: "bool",
        itemIds: "uint256[]",        // dynamic fields last
        itemAmounts: "uint256[]",
      },
    },
    ///////////////////////////////////// ARENA / STRUCTURED PVP ///////////////////////////////////
    ArenaQueue: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        queueType: "uint256",        // 1v1, 2v2, 3v3
        queuedAt: "uint256",
        rating: "int256",
      },
    },
    ArenaMatch: {
      key: ["matchId"],
      schema: {
        matchId: "uint256",
        matchType: "uint256",
        startedAt: "uint256",
        endedAt: "uint256",
        winnerId: "bytes32",
        seasonId: "uint256",
        equalized: "bool",
      },
    },
    ArenaMatchParticipant: {
      key: ["matchId", "characterId"],
      schema: {
        matchId: "uint256",
        characterId: "bytes32",
        team: "uint256",
        ratingBefore: "int256",
        ratingAfter: "int256",
        damageDealt: "uint256",
      },
    },
    ArenaSeasonReward: {
      key: ["seasonId", "tier"],
      schema: {
        seasonId: "uint256",
        tier: "uint256",
        minRating: "int256",
        titleReward: "uint256",
        itemReward: "uint256",
        goldReward: "uint256",
      },
    },
    ///////////////////////////////////// CRAFTING SPECIALIZATION ///////////////////////////////////
    CraftingSpecialization: {
      key: ["characterId", "specializationId"],
      schema: {
        characterId: "bytes32",
        specializationId: "uint256",
        level: "uint256",
        xp: "uint256",
        bonusYieldBps: "uint256",
        materialReductionBps: "uint256",
      },
    },
    CraftingSpecConfig: {
      key: [],
      schema: {
        maxSpecializations: "uint256",
        xpPerCraft: "uint256",
      },
    },
    ///////////////////////////////////// ITEM SETS ///////////////////////////////////
    ItemSetDefinition: {
      key: ["setId"],
      schema: {
        setId: "uint256",
        name: "string",              // dynamic field last
        itemIds: "uint256[]",        // dynamic field last
      },
    },
    ItemSetBonus: {
      key: ["setId", "piecesRequired"],
      schema: {
        setId: "uint256",
        piecesRequired: "uint256",   // 2-piece, 4-piece, etc.
        bonusType: "uint256",
        bonusValue: "int256",
        bonusEffectId: "bytes32",    // 0 = pure stat, otherwise Effects reference
      },
    },
    ItemSetMembership: {
      key: ["itemId"],
      schema: {
        itemId: "uint256",
        setId: "uint256",
      },
    },
    ///////////////////////////////////// WAGERED DUELS ///////////////////////////////////
    // Trustless PvP stakes — both sides escrow gold/items
    Wager: {
      key: ["wagerId"],
      schema: {
        wagerId: "uint256",
        challenger: "bytes32",
        opponent: "bytes32",
        challengerGold: "uint256",
        opponentGold: "uint256",
        accepted: "bool",
        resolved: "bool",
        winner: "bytes32",
        encounterId: "bytes32",      // links to CombatEncounter
        createdAt: "uint256",
        challengerItems: "uint256[]", // dynamic fields last
        opponentItems: "uint256[]",
      },
    },
    ///////////////////////////////////// KARMA / ALIGNMENT ///////////////////////////////////
    Karma: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        score: "int256",             // negative = outlaw, positive = hero
        lifetimePkKills: "uint256",
        lifetimeHelpActions: "uint256",
        alignment: "uint256",        // derived tier
        lastMurderAt: "uint256",
      },
    },
    KarmaThreshold: {
      key: ["tier"],
      schema: {
        tier: "uint256",
        minScore: "int256",
        maxScore: "int256",
        shopAccess: "bool",
        guardProtection: "bool",
        bountyMultiplierBps: "uint256",
      },
    },
    ///////////////////////////////////// STRONGHOLD / PERSONAL BASE ///////////////////////////////////
    Stronghold: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        level: "uint256",
        xp: "uint256",
        maxWorkers: "uint256",
        maxCraftingStations: "uint256",
        createdAt: "uint256",
      },
    },
    StrongholdResearch: {
      key: ["characterId", "researchId"],
      schema: {
        characterId: "bytes32",
        researchId: "uint256",
        startedAt: "uint256",
        completesAt: "uint256",
        completed: "bool",
      },
    },
    ResearchDefinition: {
      key: ["researchId"],
      schema: {
        researchId: "uint256",
        prereqResearchId: "uint256",
        durationSeconds: "uint256",
        goldCost: "uint256",
        levelRequired: "uint256",
        name: "string",             // dynamic fields last
        effects: "bytes32[]",
      },
    },
    ///////////////////////////////////// SEASON PASS / BATTLE PASS ///////////////////////////////////
    SeasonPass: {
      key: ["seasonId"],
      schema: {
        seasonId: "uint256",
        startAt: "uint256",
        endAt: "uint256",
        maxTier: "uint256",
        active: "bool",
        name: "string",             // dynamic field last
      },
    },
    SeasonPassTier: {
      key: ["seasonId", "tier"],
      schema: {
        seasonId: "uint256",
        tier: "uint256",
        xpRequired: "uint256",
        rewardItemId: "uint256",
        rewardGold: "uint256",
        rewardTitleId: "uint256",
      },
    },
    SeasonPassProgress: {
      key: ["characterId", "seasonId"],
      schema: {
        characterId: "bytes32",
        seasonId: "uint256",
        currentXp: "uint256",
        currentTier: "uint256",
        claimedUpToTier: "uint256",
      },
    },
    SeasonChallenge: {
      key: ["seasonId", "challengeId"],
      schema: {
        seasonId: "uint256",
        challengeId: "uint256",
        challengeType: "uint256",
        targetId: "uint256",
        requiredCount: "uint256",
        xpReward: "uint256",        // season XP, not character XP
      },
    },
    SeasonChallengeProgress: {
      key: ["characterId", "seasonId", "challengeId"],
      schema: {
        characterId: "bytes32",
        seasonId: "uint256",
        challengeId: "uint256",
        currentCount: "uint256",
        completed: "bool",
      },
    },
    ///////////////////////////////////// PRICE ALERTS (offchain) ///////////////////////////////////
    PriceAlert: {
      key: ["alertId"],
      schema: {
        alertId: "uint256",
        owner: "bytes32",            // characterId
        itemId: "uint256",
        targetPrice: "uint256",
        isBelow: "bool",             // true = alert when below target
        triggered: "bool",
        createdAt: "uint256",
      },
      type: "offchainTable",
    },
  },
  excludeSystems: ["RngSystem"],
});
