/* eslint-disable no-console */
import {
  decodeAbiParameters,
  formatEther,
  hexToBigInt,
  parseEther,
  sliceHex,
} from 'viem';

import {
  AdvancedClass,
  ArmorType,
  type EntityStats,
  type Metadata,
  type MonsterStats,
  PowerSource,
  Race,
} from '../utils/types';
import { ITEM_DESCRIPTIONS } from './itemDescriptions';

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
          { name: 'powerSource', type: 'uint8' },
          { name: 'race', type: 'uint8' },
          { name: 'startingArmor', type: 'uint8' },
          { name: 'advancedClass', type: 'uint8' },
          { name: 'hasSelectedAdvancedClass', type: 'bool' },
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
    // Implicit class system fields
    powerSource: (characterBaseStats.powerSource as number) ?? PowerSource.None,
    race: (characterBaseStats.race as number) ?? Race.None,
    startingArmor: (characterBaseStats.startingArmor as number) ?? ArmorType.None,
    advancedClass: (characterBaseStats.advancedClass as number) ?? AdvancedClass.None,
    hasSelectedAdvancedClass: characterBaseStats.hasSelectedAdvancedClass ?? false,
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
          { name: 'agility', type: 'int256' },
          { name: 'armor', type: 'int256' },
          { name: 'class', type: 'uint8' },
          { name: 'experience', type: 'uint256' },
          { name: 'hasBossAI', type: 'bool' },
          { name: 'hitPoints', type: 'int256' },
          { name: 'intelligence', type: 'int256' },
          { name: 'inventory', type: 'uint256[]' },
          { name: 'level', type: 'uint256' },
          { name: 'strength', type: 'int256' },
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
    hasBossAI: monsterTemplateStats.hasBossAI,
    hitPoints: monsterTemplateStats.hitPoints,
    intelligence: monsterTemplateStats.intelligence,
    inventory: monsterTemplateStats.inventory.map(i => i.toString()),
    level: monsterTemplateStats.level,
    strength: monsterTemplateStats.strength,
  };
};

export const getStatSymbol = (stat: string): string =>
  Number(stat) >= 0 ? '+' : '';

/**
 * Parse a text-only URI (e.g., "monster:training_dummy", "text:Hero") into a display name
 * Converts underscores to spaces and capitalizes each word
 */
export const parseTextUri = (uri: string): string => {
  const parts = uri.split(':');
  if (parts.length < 2) return uri;
  const rawName = parts.slice(1).join(':'); // Handle names with colons
  return rawName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Check if a URI is a text-only URI (not requiring HTTP fetch)
 */
export const isTextOnlyUri = (uri: string): boolean => {
  if (!uri) return false;
  const protocol = uri.split(':')[0].toLowerCase();
  return ['text', 'monster', 'item', 'armor', 'weapon', 'spell', 'consumable', 'accessory'].includes(protocol);
};

const METADATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
export const METADATA_FETCH_TIMEOUT_MS = 5000;

const getCachedMetadata = (uri: string): Metadata | null => {
  try {
    const raw = localStorage.getItem('metadata:' + uri);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > METADATA_CACHE_TTL) {
      localStorage.removeItem('metadata:' + uri);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setCachedMetadata = (uri: string, data: Metadata): void => {
  try {
    localStorage.setItem('metadata:' + uri, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full or unavailable — ignore
  }
};

export const fetchMetadataFromUri = async (uri: string): Promise<Metadata> => {
  // Handle empty or invalid URIs
  if (!uri || uri.trim() === '') {
    return {
      name: '',
      description: '',
      image: '',
    };
  }

  // Handle text-only URIs (no HTTP fetch needed)
  if (isTextOnlyUri(uri)) {
    const name = parseTextUri(uri);
    return {
      name,
      description: ITEM_DESCRIPTIONS[uri] ?? '',
      image: '',
    };
  }

  // Check localStorage cache for non-text URIs
  const cached = getCachedMetadata(uri);
  if (cached) return cached;

  // Check if it's a local development URI
  if (import.meta.env.DEV && uri.includes('local-')) {
    try {
      // For local URIs, we need to extract just the filename part
      // It might be a full URI like ipfs://local-1234-file.json or just local-1234-file.json
      const segments = uri.split('/');
      const filename = segments[segments.length - 1];
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const localUrl = `${apiUrl}/files/${filename}`;
      console.log(`Development mode: Fetching from local API at ${localUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(localUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch from local API: ${localUrl}`);
      }
      const metadata = await res.json();
      metadata.name = metadata.name || '';
      metadata.description = metadata.description || '';

      // If image is local, properly format it for local access
      if (metadata.image && metadata.image.includes('local-')) {
        const imgFilename = metadata.image.split('/').pop();
        metadata.image = `${apiUrl}/files/${imgFilename}`;
      } else {
        metadata.image = uriToHttp(metadata.image)[0] || '';
      }

      setCachedMetadata(uri, metadata);
      return metadata;
    } catch (error) {
      console.error('Error fetching from local API:', error);
      throw error;
    }
  }

  // Standard IPFS/HTTP handling for non-local URIs
  const urls = uriToHttp(uri);

  // If no valid URLs could be generated, return empty metadata
  if (urls.length === 0) {
    return {
      name: '',
      description: '',
      image: '',
    };
  }

  let lastError: Error | null = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        lastError = new Error(`Failed to fetch from ${url}`);
        console.error(`Failed to fetch from ${url}`);
        continue;
      }

      const metadata = await res.json();
      metadata.name = metadata.name || '';
      metadata.description = metadata.description || '';
      metadata.image = uriToHttp(metadata.image)[0] || '';

      setCachedMetadata(uri, metadata);
      return metadata;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;
      console.error(`Failed to fetch from ${url}:`, error);
      continue;
    }
  }

  console.warn('[fetchMetadataFromUri] All gateways failed for', uri, lastError);
  return { name: '', description: '', image: '' };
};

const IPFS_GATEWAYS = [
  'https://violet-magnetic-tick-248.mypinata.cloud',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://gateway.pinata.cloud',
  'https://dweb.link',
  'https://ipfs.fleek.co',
];

/**
 * Given a URI that may be ipfs, ipns, http, https, ar, or data protocol, return the fetch-able http(s) URLs for the same content
 * @param uri to convert to fetch-able http url
 */
export const uriToHttp = (uri: string): string[] => {
  // Handle empty or invalid URIs
  if (!uri || uri.trim() === '') {
    return [];
  }

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
        if (!hash) return [];
        return IPFS_GATEWAYS.map(gateway => `${gateway}/ipfs/${hash}`);
      }
      case 'ipns': {
        const name = uri.match(/^ipns:(\/\/)?(.*)$/i)?.[2];
        if (!name) return [];
        return IPFS_GATEWAYS.map(gateway => `${gateway}/ipns/${name}`);
      }
      case 'ar': {
        const tx = uri.match(/^ar:(\/\/)?(.*)$/i)?.[2];
        if (!tx) return [];
        return [`https://arweave.net/${tx}`];
      }
      default:
        return [];
    }
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const shortenAddress = (address: string, length = 4): string =>
  `${address.slice(0, length + 2)}...${address.slice(-length)}`;

export const startsWithVowel = (str: string): boolean => {
  return /^[aeiou]/i.test(str);
};
