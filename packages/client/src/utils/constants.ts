export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export const MAX_EQUIPPED_ARMOR = 1;
export const MAX_EQUIPPED_WEAPONS = 2;

export const BATTLE_OUTCOME_SEEN_KEY = 'latest-battle-outcome-seen';
export const CURRENT_BATTLE_MONSTER_TURN_KEY = 'current-battle-monster-turn';
export const CURRENT_BATTLE_USER_TURN_KEY = 'current-battle-user-turn';
export const ERC_1155ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
    ],
    name: 'isApprovedForAll',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
