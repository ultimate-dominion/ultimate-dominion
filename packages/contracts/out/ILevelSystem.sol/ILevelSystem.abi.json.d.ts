declare const abi: [
  {
    "type": "function",
    "name": "UD__UD__getCurrentAvailableLevel",
    "inputs": [
      {
        "name": "experience",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "currentAvailableLevel",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "UD__UD__levelCharacter",
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
    "name": "UD__calculateLevelBonuses",
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
    "name": "UD__validateLevelRequirements",
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
    "outputs": [
      {
        "name": "isValid",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "error",
    "name": "LevelSystem_CharacterInCombat",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LevelSystem_CharacterNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LevelSystem_InsufficientExperience",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LevelSystem_InvalidLevel",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LevelSystem_InvalidStatChanges",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LevelSystem_MaxLevelReached",
    "inputs": []
  }
];

export default abi;
