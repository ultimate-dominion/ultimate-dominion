export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export const MAX_EQUIPPED_ARMOR = 1;
export const MAX_EQUIPPED_WEAPONS = 4;

export const BATTLE_OUTCOME_SEEN_KEY = 'latest-battle-outcome-seen';
export const CURRENT_BATTLE_OPPONENT_TURN_KEY = 'current-battle-opponent-turn';
export const CURRENT_BATTLE_USER_TURN_KEY = 'current-battle-user-turn';
export const IS_CHAT_BOX_OPEN_KEY = 'is-chat-box-open';

export const ERC_1155_ABI = [
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

export const STATUS_EFFECT_NAME_MAPPING: { [key: string]: string } = {
  '0x940c7cad73f61cb6000000000000000000000000000000000000000000000000':
    'AGI boost',
  '0xd2812fe9b0b2cad2000000000000000000000000000000000000000000000000': 'blind',
  '0xe4d5d6c80f689bee000000000000000000000000000000000000000000000000': 'drunk',
  '0x54d076d5607dc751000000000000000000000000000000000000000000000000':
    'INT boost',
  '0x78ded5c390ab6de3000000000000000000000000000000000000000000000000':
    'poison',
  '0x5b73694f86a16512000000000000000000000000000000000000000000000000':
    'STR boost',
  '0x54a7e38986f19669000000000000000000000000000000000000000000000000':
    'stupify',
  '0x98562f2b32aeb98f000000000000000000000000000000000000000000000000':
    'weaken',
};
