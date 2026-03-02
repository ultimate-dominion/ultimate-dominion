declare const abi: [
  {
    "type": "function",
    "name": "UD__calculateStatBonuses",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "statPoints",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "hpGain",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getBaseStats",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getClass",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum Classes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getCurrentAvailableLevel",
    "inputs": [
      {
        "name": "experience",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getExperience",
    "inputs": [
      {
        "name": "characterId",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getLevel",
    "inputs": [
      {
        "name": "characterId",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__getStats",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__levelCharacter",
    "inputs": [
      {
        "name": "characterId",
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
    "name": "UD__rollStats",
    "inputs": [
      {
        "name": "userRandomNumber",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "class",
        "type": "uint8",
        "internalType": "enum Classes"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "UD__setStats",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "stats",
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
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__updateStats",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "newStats",
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
    "name": "UD__validateStatRequirements",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "requiredStats",
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
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  }
];

export default abi;
