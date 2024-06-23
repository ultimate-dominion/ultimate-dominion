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
    ItemType: ["Weapon", "Armor", "Potion", "Scroll", "Material", "QuestItem"],
    MobType: ["Monster", "NPC"],
    Alignment: ["Loyalist", "Neutral", "Rebel", "Aggro"],
    EncounterType: ["PvP", "PvE"],
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
        defenders: "uint256[]",
        // array of playerIds
        attackers: "uint256[]",
      },
      key: ["encounterId"],
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
