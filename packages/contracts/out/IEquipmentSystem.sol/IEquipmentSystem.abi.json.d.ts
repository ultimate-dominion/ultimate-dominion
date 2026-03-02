declare const abi: [
  {
    "type": "function",
    "name": "UD__calculateEquipmentBonuses",
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
    "name": "UD__checkItemEffect",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "effectId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "hasAction",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__checkRequirements",
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
      }
    ],
    "outputs": [
      {
        "name": "canUse",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__equipItems",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "itemIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__getCombatStats",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "modifiedStats",
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
    "name": "UD__getItemEffects",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "effects",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__isEquipped",
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
      }
    ],
    "outputs": [
      {
        "name": "_isEquipped",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__unequipItem",
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
  }
];

export default abi;
