import { useEffect, useState } from 'react';
import { erc721Abi } from 'viem';
import { useMUD } from '../contexts/MUDContext';

const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';

// Badge base IDs from contracts/constants.sol
const BADGE_ADVENTURER = 1;
const BADGE_FOUNDER = 50;
const BADGE_ZONE_CONQUEROR_BASE = 100; // + zoneId
const BADGE_ZONE_FRAGMENT_BASE = 200; // + zoneId

const ZONE_DARK_CAVE = 1;

export type BadgeType = 'adventurer' | 'founder' | 'zone_conqueror' | 'zone_fragment';

export type Badge = {
  type: BadgeType;
  label: string;
  description: string;
  color: string;
};

const BADGE_DEFS: { type: BadgeType; base: number; label: string; description: string; color: string }[] = [
  {
    type: 'adventurer',
    base: BADGE_ADVENTURER,
    label: 'Adventurer',
    description: 'Reached Level 3',
    color: '#6A8AB0',
  },
  {
    type: 'founder',
    base: BADGE_FOUNDER,
    label: 'Founder',
    description: 'Early supporter during launch window',
    color: '#D4A54A',
  },
  {
    type: 'zone_conqueror',
    base: BADGE_ZONE_CONQUEROR_BASE + ZONE_DARK_CAVE,
    label: 'Zone Conqueror',
    description: 'Top 10 to reach max level in Dark Cave',
    color: '#B85C3A',
  },
  {
    type: 'zone_fragment',
    base: BADGE_ZONE_FRAGMENT_BASE + ZONE_DARK_CAVE,
    label: 'Lore Keeper',
    description: 'Collected all 8 Dark Cave fragments',
    color: '#A8DEFF',
  },
];

export const useBadges = (
  characterOwner: string | undefined,
  characterTokenId: string | undefined,
): { badges: Badge[]; isLoading: boolean } => {
  const {
    network: { publicClient },
  } = useMUD();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!characterOwner || !characterTokenId || !publicClient || !BADGE_CONTRACT_ADDRESS) {
      setBadges([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const checkAll = async () => {
      setIsLoading(true);
      const found: Badge[] = [];

      await Promise.all(
        BADGE_DEFS.map(async (def) => {
          try {
            const badgeTokenId = BigInt(def.base) * BigInt(1_000_000) + BigInt(characterTokenId);
            const owner = await publicClient.readContract({
              address: BADGE_CONTRACT_ADDRESS as `0x${string}`,
              abi: erc721Abi,
              functionName: 'ownerOf',
              args: [badgeTokenId],
            });
            if (owner === characterOwner) {
              found.push({
                type: def.type,
                label: def.label,
                description: def.description,
                color: def.color,
              });
            }
          } catch {
            // Badge not minted or other error — skip
          }
        }),
      );

      if (!cancelled) {
        // Sort in consistent order: adventurer, founder, zone_conqueror, zone_fragment
        const order: BadgeType[] = ['adventurer', 'founder', 'zone_conqueror', 'zone_fragment'];
        found.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
        setBadges(found);
        setIsLoading(false);
      }
    };

    checkAll();

    return () => {
      cancelled = true;
    };
  }, [characterOwner, characterTokenId, publicClient]);

  return { badges, isLoading };
};
