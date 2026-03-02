declare const abi: [
  {
    "type": "function",
    "name": "UD__physicalAttack",
    "inputs": [
      {
        "name": "randomNumber",
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
        "name": "hit",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "crit",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "damage",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "view"
  }
];

export default abi;
