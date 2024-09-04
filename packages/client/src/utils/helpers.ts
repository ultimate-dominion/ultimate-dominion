import { decodeAbiParameters, hexToBigInt } from 'viem';

import { type Metadata, type MonsterStats } from '../utils/types';

export const getEmoji = (name: string): string => {
  return name
    ? name.match(/[\p{Emoji}\u200d]+/gu)?.toString() || ''
    : name || '';
};

export const removeEmoji = (name: string): string => {
  return name ? name.replace(/[\p{Emoji}\u200d]+/gu, '') || '' : name || '';
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

export const decodeMonsterId = (
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
    agility: monsterTemplateStats.agility.toString(),
    armor: monsterTemplateStats.armor.toString(),
    entityClass: monsterTemplateStats.class,
    experience: monsterTemplateStats.experience.toString(),
    hitPoints: monsterTemplateStats.hitPoints.toString(),
    intelligence: monsterTemplateStats.intelligence.toString(),
    inventory: monsterTemplateStats.inventory.map(i => i.toString()),
    level: monsterTemplateStats.level.toString(),
    strength: monsterTemplateStats.strength.toString(),
  };
};

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
  // 'https://black-bright-cuckoo-327.mypinata.cloud',
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
