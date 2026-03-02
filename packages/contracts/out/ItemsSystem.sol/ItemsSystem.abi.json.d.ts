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
    "name": "getArmorStats",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_ArmorStats",
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
    "name": "getConsumableStats",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_consumableStats",
        "type": "tuple",
        "internalType": "struct ConsumableStatsData",
        "components": [
          {
            "name": "minDamage",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "maxDamage",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "minLevel",
            "type": "uint256",
            "internalType": "uint256"
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
    "name": "getItemBalance",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_balance",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getItemType",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum ItemType"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStarterConsumables",
    "inputs": [],
    "outputs": [
      {
        "name": "itemIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStarterItems",
    "inputs": [
      {
        "name": "class",
        "type": "uint8",
        "internalType": "enum Classes"
      }
    ],
    "outputs": [
      {
        "name": "data",
        "type": "tuple",
        "internalType": "struct StarterItemsData",
        "components": [
          {
            "name": "itemIds",
            "type": "uint256[]",
            "internalType": "uint256[]"
          },
          {
            "name": "amounts",
            "type": "uint256[]",
            "internalType": "uint256[]"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalSupply",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_supply",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getWeaponStats",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_weaponStats",
        "type": "tuple",
        "internalType": "struct WeaponStatsData",
        "components": [
          {
            "name": "agiModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "intModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "hpModifier",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "maxDamage",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "minDamage",
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
    "name": "isItemOwner",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isStarterItem",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setStarterConsumables",
    "inputs": [
      {
        "name": "itemIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setStarterItemPool",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "isStarter",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setStarterItems",
    "inputs": [
      {
        "name": "class",
        "type": "uint8",
        "internalType": "enum Classes"
      },
      {
        "name": "itemIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "amounts",
        "type": "uint256[]",
        "internalType": "uint256[]"
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
    "name": "ArrayMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotArmor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotConsumable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotWeapon",
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
