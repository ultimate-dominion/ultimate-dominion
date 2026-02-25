export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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
  // Class spell status effects
  '0x9aad548eddd4a76c000000000000000000000000000000000000000000000000':
    'Battle Cry',
  '0xf69d7422b50eefa3000000000000000000000000000000000000000000000000':
    'Divine Shield',
  '0x243e6a3580c7821c000000000000000000000000000000000000000000000000':
    "Hunter's Mark",
  '0x22d77b1601b6e5c5000000000000000000000000000000000000000000000000':
    'Shadowstep',
  '0x284e0e9eec85ca2d000000000000000000000000000000000000000000000000':
    'Entangle',
  '0xa72795e8555f90e1000000000000000000000000000000000000000000000000':
    'Soul Drain',
  '0xd5547c9c5217a7bc000000000000000000000000000000000000000000000000':
    'Blessing',
};

export const STATUS_EFFECT_DESCRIPTION_MAPPING: Record<string, string> = {
  'AGI boost': '+5 AGI',
  blind: '-8 AGI',
  drunk: '-5 AGI, -5 INT, +8 STR',
  'INT boost': '+5 INT',
  poison: '3 damage per turn',
  'STR boost': '+5 STR',
  stupify: '-8 INT',
  weaken: '-8 STR',
  'Battle Cry': '+4 STR, +3 Armor for 3 turns',
  'Divine Shield': '+5 Armor, +3 STR for 3 turns',
  "Hunter's Mark": '-5 AGI, -2 Armor for 4 turns',
  Shadowstep: '+8 AGI for 2 turns',
  Entangle: '-5 AGI, -3 STR for 3 turns',
  'Soul Drain': '-3 STR, -3 INT for 3 turns',
  Blessing: '+3 INT, +5 Armor, +5 HP for 3 turns',
};
