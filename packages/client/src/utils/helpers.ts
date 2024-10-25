import {
  decodeAbiParameters,
  formatEther,
  hexToBigInt,
  parseEther,
  sliceHex,
} from 'viem';

import {
  type EntityStats,
  type Metadata,
  type MonsterStats,
} from '../utils/types';

export const etherToFixedNumber = (
  value: bigint | string,
  decimals = 2,
): string => {
  const bigIntValue = BigInt(value);
  const smallestDisplayAmount = parseEther('0.01');

  if (bigIntValue === 0n) {
    return '0';
  }

  if (bigIntValue < smallestDisplayAmount) {
    return '< 0.01';
  }

  const formattedValue = formatEther(bigIntValue);
  return Number(formattedValue).toFixed(decimals);
};

export const getEmoji = (name: string): string => {
  return name
    ? name.match(/[\p{Emoji}\u200d]+/gu)?.toString() || ''
    : name || '';
};

export const removeEmoji = (name: string): string => {
  return name ? name.replace(/[\p{Emoji}\u200d]+/gu, '') || '' : name || '';
};

export const decodeAppliedStatusEffectId = (
  encodedId: string,
): {
  effectId: string;
  timestamp: bigint;
  turnApplied: bigint;
} => {
  const effectId = sliceHex(encodedId as `0x${string}`, 0, 8);
  const timestampHex = sliceHex(encodedId as `0x${string}`, 8, 16);
  const turnAppliedHex = sliceHex(encodedId as `0x${string}`, 24, 32);

  const timestamp = hexToBigInt(timestampHex);
  const turnApplied = hexToBigInt(turnAppliedHex);

  return {
    effectId,
    timestamp,
    turnApplied,
  };
};

export const decodeBaseStats = (statsBytes: string): EntityStats => {
  const characterBaseStats = decodeAbiParameters(
    [
      {
        name: 'baseStats',
        type: 'tuple',
        components: [
          { name: 'strength', type: 'int256' },
          { name: 'agility', type: 'int256' },
          { name: 'class', type: 'uint8' },
          { name: 'intelligence', type: 'int256' },
          { name: 'maxHp', type: 'int256' },
          { name: 'currentHp', type: 'int256' },
          { name: 'experience', type: 'uint256' },
          { name: 'level', type: 'uint256' },
        ],
      },
    ],
    statsBytes as `0x${string}`,
  )[0];

  return {
    agility: characterBaseStats.agility,
    currentHp: characterBaseStats.currentHp,
    entityClass: characterBaseStats.class,
    experience: characterBaseStats.experience,
    intelligence: characterBaseStats.intelligence,
    level: characterBaseStats.level,
    maxHp: characterBaseStats.maxHp,
    strength: characterBaseStats.strength,
  };
};

export const decodeCharacterId = (
  characterId: `0x${string}`,
): {
  ownerAddress: string;
  characterTokenId: string;
} => {
  const bigIntValue = hexToBigInt(characterId);

  const characterTokenId = bigIntValue & ((1n << 96n) - 1n);

  const ownerAddressBigInt = bigIntValue >> 96n;
  const ownerAddress = `0x${ownerAddressBigInt.toString(16).padStart(40, '0')}`;

  return { ownerAddress, characterTokenId: characterTokenId.toString() };
};

export const decodeMobInstanceId = (
  monsterId: `0x${string}`,
): {
  mobId: string;
} => {
  const mobIdHex = monsterId.slice(2, 10);
  const mobIdBigInt = hexToBigInt(`0x${mobIdHex}`);

  return { mobId: mobIdBigInt.toString() };
};

export const decodeMonsterStats = (statsBytes: string): MonsterStats => {
  const monsterTemplateStats = decodeAbiParameters(
    [
      {
        name: 'monsterStats',
        type: 'tuple',
        components: [
          { name: 'agility', type: 'uint256' },
          { name: 'armor', type: 'uint256' },
          { name: 'class', type: 'uint8' },
          { name: 'experience', type: 'uint256' },
          { name: 'hitPoints', type: 'uint256' },
          { name: 'intelligence', type: 'uint256' },
          { name: 'inventory', type: 'uint256[]' },
          { name: 'level', type: 'uint256' },
          { name: 'strength', type: 'uint256' },
        ],
      },
    ],
    statsBytes as `0x${string}`,
  )[0];

  return {
    agility: monsterTemplateStats.agility,
    armor: monsterTemplateStats.armor,
    entityClass: monsterTemplateStats.class,
    experience: monsterTemplateStats.experience,
    hitPoints: monsterTemplateStats.hitPoints,
    intelligence: monsterTemplateStats.intelligence,
    inventory: monsterTemplateStats.inventory.map(i => i.toString()),
    level: monsterTemplateStats.level,
    strength: monsterTemplateStats.strength,
  };
};

export const getStatSymbol = (stat: string): string =>
  Number(stat) >= 0 ? '+' : '';

export const fetchMetadataFromUri = async (uri: string): Promise<Metadata> => {
  const res = await fetch(uri);
  if (!res.ok) throw new Error('Failed to fetch');
  const metadata = await res.json();
  metadata.name = metadata.name || '';
  metadata.description = metadata.description || '';
  metadata.image = uriToHttp(metadata.image)[0] || '';
  return metadata;
};

const IPFS_GATEWAYS = [
  'https://black-bright-cuckoo-327.mypinata.cloud',
  // 'https://cloudflare-ipfs.com',
  // 'https://ipfs.io',
];

/**
 * Given a URI that may be ipfs, ipns, http, https, ar, or data protocol, return the fetch-able http(s) URLs for the same content
 * @param uri to convert to fetch-able http url
 */
export const uriToHttp = (uri: string): string[] => {
  try {
    const protocol = uri.split(':')[0].toLowerCase();
    switch (protocol) {
      case 'data':
        return [uri];
      case 'https':
        return [uri];
      case 'http':
        return ['https' + uri.substring(4), uri];
      case 'ipfs': {
        const hash = uri.match(/^ipfs:(\/\/)?(.*)$/i)?.[2];
        return IPFS_GATEWAYS.map(g => `${g}/ipfs/${hash}`);
      }
      case 'ipns': {
        const name = uri.match(/^ipns:(\/\/)?(.*)$/i)?.[2];
        return IPFS_GATEWAYS.map(g => `${g}/ipns/${name}`);
      }
      case 'ar': {
        const tx = uri.match(/^ar:(\/\/)?(.*)$/i)?.[2];
        return [`https://arweave.net/${tx}`];
      }
      default:
        return [''];
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return [''];
  }
};

export const shortenAddress = (address: string, length = 4): string =>
  `${address.slice(0, length + 2)}...${address.slice(-length)}`;

export const startsWithVowel = (str: string): boolean => {
  return /^[aeiou]/i.test(str);
};
