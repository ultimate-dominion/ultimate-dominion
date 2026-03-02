declare const abi: [
  {
    "type": "function",
    "name": "IS_SCRIPT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployEconomy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract DeployEconomy"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployEffects",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract DeployEffects"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployItems",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract DeployItems"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployMonsters",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract DeployMonsters"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployer",
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
    "name": "getDeploymentStatus",
    "inputs": [
      {
        "name": "_worldAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "hasGold",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasCharacter",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasItems",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "itemCount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "mobCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "minimalPostDeploy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract MinimalPostDeploy"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "run",
    "inputs": [
      {
        "name": "_worldAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "runPartial",
    "inputs": [
      {
        "name": "_worldAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tiers",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "world",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IWorld"
      }
    ],
    "stateMutability": "view"
  }
];

export default abi;
