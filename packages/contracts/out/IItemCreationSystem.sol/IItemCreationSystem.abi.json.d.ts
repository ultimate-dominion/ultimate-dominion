declare const abi: [
  {
    "type": "function",
    "name": "UD__createItem",
    "inputs": [
      {
        "name": "itemType",
        "type": "uint8",
        "internalType": "enum ItemType"
      },
      {
        "name": "supply",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dropChance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "price",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "rarity",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "stats",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "itemMetadataURI",
        "type": "string",
        "internalType": "string"
      }
    ],
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
    "name": "UD__createItems",
    "inputs": [
      {
        "name": "itemTypes",
        "type": "uint8[]",
        "internalType": "enum ItemType[]"
      },
      {
        "name": "supply",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "dropChances",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "prices",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "rarities",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "stats",
        "type": "bytes[]",
        "internalType": "bytes[]"
      },
      {
        "name": "itemMetadataURIs",
        "type": "string[]",
        "internalType": "string[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__getCurrentItemsCounter",
    "inputs": [],
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
    "name": "UD__resupplyLootManager",
    "inputs": [
      {
        "name": "itemId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newSupply",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UD__setTokenUri",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "tokenUri",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

export default abi;
