import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "UD",
  deploy: {},
  userTypes: {
    ResourceId: { filePath: "@latticexyz/store/src/ResourceId.sol", type: "bytes32" },
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
    SkillType: ["PhysicalAttack", "MagicAttack", "StatusEffect"],
  },
  tables: {
    /**
     * Marks an entity as an admin. Used on address entities.
     */
    Admin: "bool",
    Characters: {
      key: ["characterId"],
      schema: {
        owner: "address",
        characterId: "uint256",
        class: "Classes",
        name: "bytes32",
        locked: "bool",
      },
    },
    CharacterStats: {
      key: ["characterId"],
      schema: {
        characterId: "uint256",
        strength: "uint256",
        agility: "uint256",
        intelligence: "uint256",
        hitPoints: "uint256",
        damageTaken: "int256",
        experience: "uint256",
      },
    },
    MobStats: {
      key: ["entityId"],
      schema: {
        entityId: "bytes32",
        strength: "uint256",
        agility: "uint256",
        intelligence: "uint256",
        hitPoints: "uint256",
        damageTaken: "int256",
        experience: "uint256",
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
        characterId: "uint256",
        equippedArmor: "uint256[]",
        equippedWeapons: "uint256[]",
        equippedSpells: "uint256[]",
      },
    },
    Counters: {
      schema: {
        contractAddress: "address",
        counter: "uint256",
      },
      key: ["contractAddress"],
    },
    Items: {
      schema: {
        itemId: "uint256",
        itemType: "ItemType",
        stats: "bytes",
      },
      key: ["itemId"],
    },
    Mobs: {
      schema: {
        mobId: "uint256",
        mobType: "MobType",
        mobStats: "bytes",
        mobMetadata: "string",
      },
      key: ["mobId"],
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
        // the current turn.  starts at 0
        currentTurn: "uint256",
        // the max number of turns. default is 15 for pve
        maxTurns: "uint256",
        // array of monsterIds if pve playerIds if pvp
        defenders: "bytes32[]",
        // array of playerIds
        attackers: "bytes32[]",
      },
      key: ["encounterId"],
    },
    MobEntity: {
      key: ["mobEntityId"],
      schema: {
        mobEntityId: "bytes32",
        remainingHp: "int256",
        // by default this is bytes(0), if this mob is in an encounter it will be set,
        // if the mob survives its encounter this will be set back to bytes(0)
        encounterId: "bytes32",
      },
    },
    RandomNumbers: {
      key: ["sequenceNumber"],
      schema: {
        sequenceNumber: "uint64",
        RequestType: "RngRequestType",
        arbitraryData: "bytes",
      },
    },
    /**
     * The position of an entity.
     */
    Position: {
      key: ["matchEntity", "entity"],
      schema: {
        matchEntity: "bytes32",
        entity: "bytes32",
        x: "int32",
        y: "int32",
      },
    },
    EntitiesAtPosition: {
      key: ["matchEntity", "x", "y"],
      schema: {
        matchEntity: "bytes32",
        x: "int32",
        y: "int32",
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
  },
  excludeSystems: ["RngSystem"],
});
