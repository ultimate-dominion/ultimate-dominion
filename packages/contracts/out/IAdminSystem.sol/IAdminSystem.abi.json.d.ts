declare const abi: [
  {
    "type": "function",
    "name": "UD__adminApplyStatusEffect",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "statusEffectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminClearEncounterState",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminCreateEffect",
    "inputs": [
      {
        "name": "effectType",
        "type": "uint8",
        "internalType": "enum EffectType"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "effectStats",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminCreateItem",
    "inputs": [
      {
        "name": "itemType",
        "type": "uint8",
        "internalType": "enum ItemType"
      },
      {
        "name": "supply",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dropChance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "price",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "rarity",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "stats",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "itemMetadataURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminCreateItems",
    "inputs": [
      {
        "name": "itemTypes",
        "type": "uint8[]",
        "internalType": "enum ItemType[]"
      },
      {
        "name": "supply",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "dropChances",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "prices",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "rarities",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "stats",
        "type": "bytes[]",
        "internalType": "bytes[]"
      },
      {
        "name": "itemMetadataURIs",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminCreateMob",
    "inputs": [
      {
        "name": "mobType",
        "type": "uint8",
        "internalType": "enum MobType"
      },
      {
        "name": "stats",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "mobMetadataUri",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminCreateMobs",
    "inputs": [
      {
        "name": "mobTypes",
        "type": "uint8[]",
        "internalType": "enum MobType[]"
      },
      {
        "name": "stats",
        "type": "bytes[]",
        "internalType": "bytes[]"
      },
      {
        "name": "mobMetadataURIs",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminDropGold",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "goldAmount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminDropItem",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminMoveEntity",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "x",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "y",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminRemoveEntity",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminResupplyLootManager",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newSupply",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminSetCombatEncounter",
    "inputs": [
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "encounterData",
        "type": "tuple",
        "internalType": "struct CombatEncounterData",
        "components": [
          {
            "name": "encounterType",
            "type": "uint8",
            "internalType": "enum EncounterType"
          },
          {
            "name": "start",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "end",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "rewardsDistributed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "currentTurn",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "currentTurnTimer",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxTurns",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "attackersAreMobs",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "defenders",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "attackers",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminSetEncounterEntity",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "encounterEntityData",
        "type": "tuple",
        "internalType": "struct EncounterEntityData",
        "components": [
          {
            "name": "encounterId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "died",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "pvpTimer",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "appliedStatusEffects",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__adminSetStats",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "desiredStats",
        "type": "tuple",
        "internalType": "struct StatsData",
        "components": [
          {
            "name": "strength",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "agility",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "class",
            "type": "uint8",
            "internalType": "enum Classes"
          },
          {
            "name": "intelligence",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "maxHp",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "currentHp",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "experience",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "level",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "powerSource",
            "type": "uint8",
            "internalType": "enum PowerSource"
          },
          {
            "name": "race",
            "type": "uint8",
            "internalType": "enum Race"
          },
          {
            "name": "startingArmor",
            "type": "uint8",
            "internalType": "enum ArmorType"
          },
          {
            "name": "advancedClass",
            "type": "uint8",
            "internalType": "enum AdvancedClass"
          },
          {
            "name": "hasSelectedAdvancedClass",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__getSystemAddress",
    "inputs": [
      {
        "name": "systemId",
        "type": "bytes32",
        "internalType": "ResourceId"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__setAdmin",
    "inputs": [
      {
        "name": "newAdmin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "adminState",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__setMaxPlayers",
    "inputs": [
      {
        "name": "newMax",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

export default abi;
