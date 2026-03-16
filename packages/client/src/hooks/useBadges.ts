import { useEffect, useMemo, useState } from 'react';
import { erc721Abi } from 'viem';
import { useMUD } from '../contexts/MUDContext';
import { useGameConfig, useGameTable } from '../lib/gameStore';
import type { Character } from '../utils/types';

// Badge base IDs from contracts/constants.sol
const BADGE_FOUNDER = 50;
const BADGE_ZONE_FRAGMENT_BASE = 200; // + zoneId
const ZONE_DARK_CAVE = 1;
const ADVENTURER_BADGE_LEVEL = 3;
const MAX_ZONE_CONQUEROR_BADGES = 10;

export type BadgeType = 'adventurer' | 'founder' | 'zone_conqueror' | 'zone_fragment';

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
};

// NFT-only badges — Founder and Lore Keeper still require on-chain check
const NFT_BADGE_DEFS: { type: BadgeType; base: number }[] = [
  { type: 'founder', base: BADGE_FOUNDER },
  { type: 'zone_fragment', base: BADGE_ZONE_FRAGMENT_BASE + ZONE_DARK_CAVE },
];

const BADGE_ORDER: BadgeType[] = ['adventurer', 'founder', 'zone_conqueror', 'zone_fragment'];

export const useBadges = (
  character: Character | null | undefined,
): { badges: Badge[]; isLoading: boolean } => {
  const {
    network: { publicClient },
  } = useMUD();

  const config = useGameConfig('UltimateDominionConfig');
  const badgeContractAddress = config?.badgeToken as string | undefined;

  // Zone completion data — used to infer Zone Conqueror badge
  const zoneCompletionTable = useGameTable('CharacterZoneCompletion');

  // Infer Adventurer badge from level
  const hasAdventurer = useMemo(() => {
    if (!character) return false;
    return Number(character.level) >= ADVENTURER_BADGE_LEVEL;
  }, [character]);

  // Infer Zone Conqueror badge from CharacterZoneCompletion table
  const hasZoneConqueror = useMemo(() => {
    if (!character || !zoneCompletionTable) return false;

    // Find this character's zone completion entry
    for (const data of Object.values(zoneCompletionTable)) {
      if (
        data.characterId === character.id &&
        data.completed &&
        Number(data.rank) <= MAX_ZONE_CONQUEROR_BADGES
      ) {
        return true;
      }
    }
    return false;
  }, [character, zoneCompletionTable]);

  // NFT-based badges (Founder, Lore Keeper) — checked via RPC
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
    if (hasZoneConqueror) types.add('zone_conqueror');
    for (const t of nftBadgeTypes) types.add(t);

    return BADGE_ORDER
      .filter(t => types.has(t))
      .map(t => ({ type: t, ...BADGE_INFO[t] }));
  }, [hasAdventurer, hasZoneConqueror, nftBadgeTypes]);

  return { badges, isLoading: isLoadingNft };
};
