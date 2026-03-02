declare const abi: [
  {
    "type": "function",
    "name": "roundInt",
    "inputs": [
      {
        "name": "value",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "baseUnit",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "roundUint",
    "inputs": [
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "baseUnit",
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
    "stateMutability": "pure"
  },
  {
    "type": "error",
    "name": "IntOverflow",
    "inputs": []
  }
];

export default abi;
