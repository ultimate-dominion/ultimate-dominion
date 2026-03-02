declare const abi: [
  {
    "type": "function",
    "name": "UD__calculateAccessoryBonuses",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "armorBonus",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "strBonus",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "agiBonus",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "intBonus",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "hpBonus",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__checkAccessoryRequirements",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "canEquip",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__equipAccessory",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__getAccessoryStats",
    "inputs": [
      {
        "name": "accessoryId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "accessoryStats",
        "type": "tuple",
        "internalType": "struct AccessoryStatsData",
        "components": [
          {
            "name": "agiModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "armorModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "hpModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "intModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "minLevel",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "strModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "effects",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getEquippedAccessories",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "equippedAccessories",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__isAccessoryEquipped",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "isEquipped",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__unequipAccessory",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
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
    "name": "AccessoryBonusesCalculated",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "armorBonus",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "strBonus",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "agiBonus",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "intBonus",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "hpBonus",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AccessoryEquipped",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AccessoryUnequipped",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "accessoryId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
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
    "type": "error",
    "name": "AccessorySystem_AlreadyEquipped",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_CharacterNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_ItemNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_LevelTooLow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_NotAccessory",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_NotEquipped",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessorySystem_RequirementsNotMet",
    "inputs": []
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
  }
];

export default abi;
