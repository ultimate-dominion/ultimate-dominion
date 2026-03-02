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
    "name": "physicalAttack",
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
    "type": "error",
    "name": "IntOverflow",
    "inputs": []
  }
];

export default abi;
