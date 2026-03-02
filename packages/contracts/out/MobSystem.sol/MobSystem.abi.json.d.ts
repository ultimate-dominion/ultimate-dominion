declare const abi: [
  {
    "type": "function",
    "name": "_msgSender",
    "inputs": [],
    "outputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "_msgValue",
    "inputs": [],
    "outputs": [
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "_world",
    "inputs": [],
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
    "name": "createMob",
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
    "name": "createMobs",
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
    "name": "getMob",
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
    "name": "getMob",
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
    "name": "getMobId",
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
    "name": "getMobPositionFromId",
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
    "name": "getMonsterCombatStats",
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
    "name": "getMonsterStats",
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
    "name": "getNpcStats",
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
    "name": "getNpcStats",
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
    "name": "getSpawnCounter",
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
    "name": "isValidMob",
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
    "name": "spawnMob",
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
    "name": "spawnMobs",
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
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "Store_SetRecord",
    "inputs": [
      {
        "name": "tableId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "ResourceId"
      },
      {
        "name": "keyTuple",
        "type": "bytes32[]",
        "indexed": false,
        "internalType": "bytes32[]"
      },
      {
        "name": "staticData",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      },
      {
        "name": "encodedLengths",
        "type": "bytes32",
        "indexed": false,
        "internalType": "EncodedLengths"
      },
      {
        "name": "dynamicData",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Store_SpliceDynamicData",
    "inputs": [
      {
        "name": "tableId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "ResourceId"
      },
      {
        "name": "keyTuple",
        "type": "bytes32[]",
        "indexed": false,
        "internalType": "bytes32[]"
      },
      {
        "name": "dynamicFieldIndex",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "start",
        "type": "uint48",
        "indexed": false,
        "internalType": "uint48"
      },
      {
        "name": "deleteCount",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      },
      {
        "name": "encodedLengths",
        "type": "bytes32",
        "indexed": false,
        "internalType": "EncodedLengths"
      },
      {
        "name": "data",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Store_SpliceStaticData",
    "inputs": [
      {
        "name": "tableId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "ResourceId"
      },
      {
        "name": "keyTuple",
        "type": "bytes32[]",
        "indexed": false,
        "internalType": "bytes32[]"
      },
      {
        "name": "start",
        "type": "uint48",
        "indexed": false,
        "internalType": "uint48"
      },
      {
        "name": "data",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EncodedLengths_InvalidLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MaxMobSpawns",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MaxMobTypes",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MobArrayMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Slice_OutOfBounds",
    "inputs": [
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
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
      }
    ]
  },
  {
    "type": "error",
    "name": "Store_IndexOutOfBounds",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "accessedIndex",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Store_InvalidResourceType",
    "inputs": [
      {
        "name": "expected",
        "type": "bytes2",
        "internalType": "bytes2"
      },
      {
        "name": "resourceId",
        "type": "bytes32",
        "internalType": "ResourceId"
      },
      {
        "name": "resourceIdString",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "Store_InvalidSplice",
    "inputs": [
      {
        "name": "startWithinField",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "deleteCount",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "fieldLength",
        "type": "uint40",
        "internalType": "uint40"
      }
    ]
  },
  {
    "type": "error",
    "name": "World_AccessDenied",
    "inputs": [
      {
        "name": "resource",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "WrongMobType",
    "inputs": []
  }
];

export default abi;
