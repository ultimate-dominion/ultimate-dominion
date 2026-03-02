declare const abi: [
  {
    "type": "function",
    "name": "UD__executePvECombat",
    "inputs": [
      {
        "name": "randomness",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "encounterId",
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
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__isValidPvE",
    "inputs": [
      {
        "name": "attackers",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "defenders",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
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
        "name": "_isValidPvE",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "_attackersAreMobs",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  }
];

export default abi;
