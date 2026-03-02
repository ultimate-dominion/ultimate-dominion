declare const abi: [
  {
    "type": "function",
    "name": "UD__createMob",
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
    "name": "UD__createMobs",
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
    "name": "UD__getMob",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MobsData",
        "components": [
          {
            "name": "mobType",
            "type": "uint8",
            "internalType": "enum MobType"
          },
          {
            "name": "mobStats",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "mobMetadata",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getMob",
    "inputs": [
      {
        "name": "mobId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MobsData",
        "components": [
          {
            "name": "mobType",
            "type": "uint8",
            "internalType": "enum MobType"
          },
          {
            "name": "mobStats",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "mobMetadata",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getMobId",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "UD__getMobPositionFromId",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
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
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "UD__getMonsterCombatStats",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "_spawnedMonsterStats",
        "type": "tuple",
        "internalType": "struct AdjustedCombatStats",
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
            "name": "intelligence",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "armor",
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
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getMonsterStats",
    "inputs": [
      {
        "name": "mobId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MonsterStats",
        "components": [
          {
            "name": "agility",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "armor",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "class",
            "type": "uint8",
            "internalType": "enum Classes"
          },
          {
            "name": "experience",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "hitPoints",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "intelligence",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "inventory",
            "type": "uint256[]",
            "internalType": "uint256[]"
          },
          {
            "name": "level",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "strength",
            "type": "int256",
            "internalType": "int256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getNpcStats",
    "inputs": [
      {
        "name": "mobId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct NPCStats",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "storyPathIds",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "alignment",
            "type": "uint8",
            "internalType": "enum Alignment"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getNpcStats",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct NPCStats",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "storyPathIds",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "alignment",
            "type": "uint8",
            "internalType": "enum Alignment"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getSpawnCounter",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "UD__isValidMob",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "_isValidMob",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__spawnMob",
    "inputs": [
      {
        "name": "mobId",
        "type": "uint256",
        "internalType": "uint256"
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
    "outputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__spawnMobs",
    "inputs": [
      {
        "name": "mobIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
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
  }
];

export default abi;
