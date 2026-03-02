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
    "name": "calculateArmorBonuses",
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
    "name": "checkArmorRequirements",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
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
    "name": "equipArmor",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getArmorStatsData",
    "inputs": [
      {
        "name": "armorId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "armorStats",
        "type": "tuple",
        "internalType": "struct ArmorStatsData",
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
            "name": "armorType",
            "type": "uint8",
            "internalType": "enum ArmorType"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEquippedArmor",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "equippedArmor",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isArmorEquippedExt",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
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
    "type": "function",
    "name": "unequipArmor",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "success",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ArmorBonusesCalculated",
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
    "name": "ArmorEquipped",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ArmorUnequipped",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "armorId",
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
    "name": "ArmorSystem_AlreadyEquipped",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_CharacterNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_ItemNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_LevelTooLow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_NoArmorSlot",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_NotArmor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_NotEquipped",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ArmorSystem_RequirementsNotMet",
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
  }
];

export default abi;
