declare const abi: [
  {
    "type": "function",
    "name": "UD__createEncounter",
    "inputs": [
      {
        "name": "encounterType",
        "type": "uint8",
        "internalType": "enum EncounterType"
      },
      {
        "name": "group1",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "group2",
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
    "name": "UD__endTurn",
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
        "name": "attacks",
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
    "stateMutability": "payable"
  }
];

export default abi;
