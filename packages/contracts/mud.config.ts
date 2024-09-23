import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "UD",
  deploy: {},
  userTypes: {
    ResourceId: {
      filePath: "@latticexyz/store/src/ResourceId.sol",
      type: "bytes32",
    },
  },
  systems: {},
  enums: {
    Classes: [
      "Warrior", // 0
      "Rogue", // 1
      "Mage", // 2
    ],
    RngRequestType: ["World", "CharacterStats", "Combat"],
    ItemType: ["Weapon", "Armor", "Spell", "Consumable", "QuestItem"],
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
  },
  tables: {
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
    Stats: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        strength: "int256",
        agility: "int256",
        class: "Classes",
        intelligence: "int256",
        maxHp: "int256",
        currentHp: "int256",
        experience: "uint256",
        level: "uint256",
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
      },
    },
    ///////////////////////////////////////// ITEMS ///////////////////////////////////////////////////////
    Items: {
      schema: {
        itemId: "uint256",
        itemType: "ItemType",
        dropChance: "uint256",
        price: "uint256",
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
    ArmorStats: {
      schema: {
        itemId: "uint256",
        agiModifier: "int256",
        armorModifier: "int256",
        hpModifier: "int256",
        intModifier: "int256",
        minLevel: "uint256",
        strModifier: "int256",
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
    // when an entity starts combat it creates a "encounter entity" for that encounter.
    //when combat ends, the encounterId is set to zero
    EncounterEntity: {
      key: ["encounterEntityId"],
      schema: {
        encounterEntityId: "bytes32",
        // by default this is bytes(0), if this entity is in an encounter it will be set,
        encounterId: "bytes32",
        died: "bool",
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
        entropy: "address",
        pythProvider: "address",
        items: "address",
        marketplace: "address",
        lootManager: "address",
        shop: "address",
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

    ////////////////////////////////////////// OFFCHAIN TABLES////////////////////////////////////////
    RngLogs: {
      key: ["requestId"],
      schema: {
        requestId: "uint256",
        sequenceNumber: "uint64",
        provider: "address",
        entropy: "address",
        fee: "uint256",
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
        expDropped: "uint256",
        goldDropped: "uint256",
        itemsDropped: "uint256[]",
      },
      key: ["encounterId"],
      type: "offchainTable",
    },
  },
  excludeSystems: ["RngSystem"],
});
