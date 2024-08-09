declare const abi: [
  {
    "type": "function",
    "name": "_calculateMagicAttack",
    "inputs": [],
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
    "stateMutability": "pure"
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
    "name": "checkForMatchEnd",
    "inputs": [
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
            "name": "maxTurns",
            "type": "uint256",
            "internalType": "uint256"
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
    "outputs": [
      {
        "name": "_matchEnded",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "_attackersWin",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createMatch",
    "inputs": [
      {
        "name": "encounterType",
        "type": "uint8",
        "internalType": "enum EncounterType"
      },
      {
        "name": "attackers",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "defenders",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "endMatch",
    "inputs": [
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "randomNumber",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "attackersWin",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "endTurn",
    "inputs": [
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "playerId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "actions",
        "type": "tuple[]",
        "internalType": "struct Action[]",
        "components": [
          {
            "name": "attackerEntityId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "defenderEntityId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "actionId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "weaponId",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "executeAction",
    "inputs": [
      {
        "name": "actionOutcomeData",
        "type": "tuple",
        "internalType": "struct ActionOutcomeData",
        "components": [
          {
            "name": "actionId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "weaponId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "attackerId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "defenderId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "hit",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "miss",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "crit",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "attackerDamageDelt",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "defenderDamageDelt",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "attackerDied",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "defenderDied",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "blockNumber",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "randomNumber",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ActionOutcomeData",
        "components": [
          {
            "name": "actionId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "weaponId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "attackerId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "defenderId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "hit",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "miss",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "crit",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "attackerDamageDelt",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "defenderDamageDelt",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "attackerDied",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "defenderDied",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "blockNumber",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getDied",
    "inputs": [
      {
        "name": "entityId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "isDied",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEncounter",
    "inputs": [
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
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
            "name": "maxTurns",
            "type": "uint256",
            "internalType": "uint256"
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isParticipant",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "participants",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [
      {
        "name": "_isParticipant",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isParticipant",
    "inputs": [
      {
        "name": "playerId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "encounterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "_isParticipant",
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
  },
  {
    "type": "error",
    "name": "World_FunctionSelectorNotFound",
    "inputs": [
      {
        "name": "functionSelector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ]
  },
  {
    "type": "error",
    "name": "World_ResourceNotFound",
    "inputs": [
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
  }
]; export default abi;
