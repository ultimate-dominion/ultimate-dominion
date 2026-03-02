declare const abi: [
  {
    "type": "function",
    "name": "getFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getRng",
    "inputs": [
      {
        "name": "userRandomNumber",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "requestType",
        "type": "uint8",
        "internalType": "enum RngRequestType"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

export default abi;
