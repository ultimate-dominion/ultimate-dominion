declare const abi: [
  {
    "type": "function",
    "name": "UD__executeWorldRngActions",
    "inputs": [
      {
        "name": "randomNumber",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "givingEntity",
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
            "name": "itemId",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__rest",
    "inputs": [
      {
        "name": "characterId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__useCombatConsumableItem",
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
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__useWorldConsumableItem",
    "inputs": [
      {
        "name": "givingEntity",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "receivingEntity",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

export default abi;
