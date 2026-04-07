import { useEffect, useMemo, useState } from 'react';
import { erc721Abi } from 'viem';
import { useMUD } from '../contexts/MUDContext';
import { useGameConfig, useGameTable } from '../lib/gameStore';
import type { Character } from '../utils/types';

// Badge base IDs from contracts/constants.sol
const BADGE_FOUNDER = 50;
const BADGE_GUILD_FOUNDER = 60;
const BADGE_ZONE_CONQUEROR_BASE = 100; // + zoneId via ZoneConfig.badgeBase
const BADGE_ZONE_PIONEER_BASE = 150; // + zoneId
const BADGE_ZONE_FRAGMENT_BASE = 200; // + zoneId
const ZONE_DARK_CAVE = 1;
const ZONE_WINDY_PEAKS = 2;
const ADVENTURER_BADGE_LEVEL = 3;
const MAX_ZONE_CONQUEROR_BADGES = 10;

export type BadgeType =
  | 'adventurer'
  | 'founder'
  | 'guild_founder'
  | 'zone_conqueror'
  | 'zone_fragment'
  | 'zone_conqueror_wp'
  | 'zone_fragment_wp'
  | 'peaks_pioneer';

export type Badge = {
  type: BadgeType;
  label: string;
  description: string;
  color: string;
};

const BADGE_INFO: Record<BadgeType, Omit<Badge, 'type'>> = {
  adventurer: {
    label: 'Adventurer',
    description: 'Reached Level 3',
    color: '#6A8AB0',
  },
  founder: {
    label: 'Founder',
    description: 'Early supporter during launch window',
    color: '#D4A54A',
  },
  guild_founder: {
    label: 'The Pact',
    description: 'Founded a guild',
    color: '#7B2D8E',
  },
  zone_conqueror: {
    label: 'Zone Conqueror',
    description: 'Top 10 to reach max level in Dark Cave',
    color: '#B85C3A',
  },
  zone_fragment: {
    label: 'Lore Keeper',
    description: 'Collected all 8 Dark Cave fragments',
    color: '#A8DEFF',
  },
  peaks_pioneer: {
    label: 'Peaks Pioneer',
    description: 'Entered the Windy Peaks',
    color: '#B4C6D4',
  },
  zone_conqueror_wp: {
    label: 'Peaks Conqueror',
    description: 'Top 10 to reach max level in Windy Peaks',
    color: '#8B9DAF',
  },
  zone_fragment_wp: {
    label: 'Peaks Lore Keeper',
    description: 'Collected all Windy Peaks fragments',
    color: '#C8D8E8',
  },
};

// NFT-only badges — require on-chain ownerOf check
const NFT_BADGE_DEFS: { type: BadgeType; base: number }[] = [
  { type: 'founder', base: BADGE_FOUNDER },
  { type: 'guild_founder', base: BADGE_GUILD_FOUNDER },
  { type: 'zone_fragment', base: BADGE_ZONE_FRAGMENT_BASE + ZONE_DARK_CAVE },
  { type: 'zone_fragment_wp', base: BADGE_ZONE_FRAGMENT_BASE + ZONE_WINDY_PEAKS },
  { type: 'peaks_pioneer', base: BADGE_ZONE_PIONEER_BASE + ZONE_WINDY_PEAKS },
];

const BADGE_ORDER: BadgeType[] = [
  'adventurer',
  'founder',
  'guild_founder',
  'zone_conqueror',
  'zone_fragment',
  'peaks_pioneer',
  'zone_conqueror_wp',
  'zone_fragment_wp',
];

export const useBadges = (
  character: Character | null | undefined,
): { badges: Badge[]; isLoading: boolean } => {
  const {
    network: { publicClient },
  } = useMUD();

  const config = useGameConfig('UltimateDominionConfig');
  const badgeContractAddress = config?.badgeToken as string | undefined;

  // Zone completion data — used to infer Zone Conqueror badges
  const zoneCompletionTable = useGameTable('CharacterZoneCompletion');

  // Infer Adventurer badge from level
  const hasAdventurer = useMemo(() => {
    if (!character) return false;
    return Number(character.level) >= ADVENTURER_BADGE_LEVEL;
  }, [character]);

  // Infer Zone Conqueror badges from CharacterZoneCompletion table
  const zoneConquerorBadges = useMemo(() => {
    const result = { dc: false, wp: false };
    if (!character || !zoneCompletionTable) return result;

    for (const data of Object.values(zoneCompletionTable)) {
      if (
        data.characterId === character.id &&
        data.completed &&
        Number(data.rank) <= MAX_ZONE_CONQUEROR_BADGES
      ) {
        const zoneId = Number(data.zoneId);
        if (zoneId === ZONE_DARK_CAVE) result.dc = true;
        if (zoneId === ZONE_WINDY_PEAKS) result.wp = true;
      }
    }
    return result;
  }, [character, zoneCompletionTable]);

  // NFT-based badges — checked via RPC
  const [nftBadgeTypes, setNftBadgeTypes] = useState<BadgeType[]>([]);
  const [isLoadingNft, setIsLoadingNft] = useState(true);

  useEffect(() => {
    const owner = character?.owner;
    const tokenId = character?.tokenId;

    if (!owner || !tokenId || !publicClient || !badgeContractAddress ||
        badgeContractAddress === '0x0000000000000000000000000000000000000000') {
      setNftBadgeTypes([]);
      setIsLoadingNft(false);
      return;
    }

    let cancelled = false;

    const checkNftBadges = async () => {
      setIsLoadingNft(true);
      const found: BadgeType[] = [];

      await Promise.all(
        NFT_BADGE_DEFS.map(async (def) => {
          try {
            const badgeTokenId = BigInt(def.base) * BigInt(1_000_000) + BigInt(tokenId);
            const nftOwner = await publicClient.readContract({
              address: badgeContractAddress as `0x${string}`,
              abi: erc721Abi,
              functionName: 'ownerOf',
              args: [badgeTokenId],
            });
            if (nftOwner.toLowerCase() === owner.toLowerCase()) {
              found.push(def.type);
            }
          } catch {
            // Badge not minted — skip
          }
        }),
      );

      if (!cancelled) {
        setNftBadgeTypes(found);
        setIsLoadingNft(false);
      }
    };

    checkNftBadges();

    return () => {
      cancelled = true;
    };
  }, [character?.owner, character?.tokenId, publicClient, badgeContractAddress]);

  // Combine inferred + NFT badges
  const badges = useMemo(() => {
    const types = new Set<BadgeType>();

    if (hasAdventurer) types.add('adventurer');
    if (zoneConquerorBadges.dc) types.add('zone_conqueror');
    if (zoneConquerorBadges.wp) types.add('zone_conqueror_wp');
    for (const t of nftBadgeTypes) types.add(t);

    return BADGE_ORDER
      .filter(t => types.has(t))
      .map(t => ({ type: t, ...BADGE_INFO[t] }));
  }, [hasAdventurer, zoneConquerorBadges, nftBadgeTypes]);

  return { badges, isLoading: isLoadingNft };
};
