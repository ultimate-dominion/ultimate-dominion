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
    RngRequestType: ["CharacterStats", "Combat", "WorldGeneration"],
    ItemType: ["Weapon", "Armor", "Spell", "Potion", "Material", "QuestItem"],
    MobType: ["Monster", "NPC"],
    Alignment: ["Loyalist", "Neutral", "Rebel", "Aggro"],
    EncounterType: ["PvP", "PvE"],
    ActionType: ["Temporary", "PhysicalAttack", "MagicAttack", "StatusEffect"],
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
    Characters: {
      key: ["characterId"],
      schema: {
        characterId: "bytes32",
        tokenId: "uint256",
        owner: "address",
        name: "bytes32",
        locked: "bool",
      },
    },
    Stats: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        strength: "uint256",
        agility: "uint256",
        class: "Classes",
        intelligence: "uint256",
        baseHp: "uint256",
        currentHp: "int256",
        experience: "uint256",
        level: "uint256",
      },
    },
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
    Mobs: {
      key: ["mobId"],
      schema: {
        mobId: "uint256",
        mobType: "MobType",
        mobStats: "bytes",
        mobMetadata: "string",
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
        armor: "uint256",
        equippedArmor: "uint256[]",
        equippedWeapons: "uint256[]",
        equippedSpells: "bytes32[]",
      },
    },
    PvPFlag: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        pvpFlag: "bool",
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
    Items: {
      schema: {
        itemId: "uint256",
        itemType: "ItemType",
        dropChance: "uint256",
        stats: "bytes",
        // probability in 10^6 e.g. 20_000_000 = 20%
      },
      key: ["itemId"],
    },
    Actions: {
      schema: {
        actionId: "bytes32",
        actionType: "ActionType",
        actionStats: "bytes",
      },
      key: ["actionId"],
    },

    StarterItems: {
      key: ["class"],
      schema: {
        class: "Classes",
        itemIds: "uint256[]",
        amounts: "uint256[]",
      },
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
    EncounterRandomness: {
      key: ["encounterId"],
      schema: {
        encounterId: "bytes32",
        currentRandomness: "uint256",
      },
    },
    // when an entity starts combat it creates a "encounter entity" for that encounter.
    //when combat ends, the encounterId is set to zero
    EncounterEntity: {
      key: ["encounterEntityId"],
      schema: {
        encounterEntityId: "bytes32",
        // by default this is bytes(0), if this entity is in an encounter it will be set,
        // if the mob survives its encounter this will be set back to bytes(0)
        encounterId: "bytes32",
        died: "bool",
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
      },
    },
    ///////////////////////// OFFCHAIN TABLES//////////////////
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
        actionNumber: "uint256",
        actionId: "bytes32",
        weaponId: "uint256",
        attackerId: "bytes32",
        defenderId: "bytes32",
        hit: "bool",
        miss: "bool",
        crit: "bool",
        attackerDamageDelt: "int256",
        defenderDamageDelt: "int256",
        attackerDied: "bool",
        defenderDied: "bool",
        blockNumber: "uint256",
        timestamp: "uint256",
      },
      key: ["encounterId", "currentTurn", "actionNumber"],
      type: "offchainTable",
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
