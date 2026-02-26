import { useEffect, useMemo, useRef, useState } from 'react';
import { formatEther } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';

const LB_GOLD_RANK_KEY = 'lb_gold_rank';

type LeaderboardRank = {
  delta: number;
  previousRank: number | null;
  rank: number;
};

/**
 * Tracks the current player's gold leaderboard rank reactively.
 * Persists last-known rank to localStorage so returning players see
 * whether they climbed or dropped.
 */
export const useLeaderboardRank = (): LeaderboardRank => {
  const { allCharacters } = useMap();
  const { character } = useCharacter();

  const [previousRank, setPreviousRank] = useState<number | null>(() => {
    const stored = localStorage.getItem(LB_GOLD_RANK_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  // Track whether we've set the initial previousRank from localStorage
  const initializedRef = useRef(false);

  const rank = useMemo(() => {
    if (!character || allCharacters.length === 0) return 0;

    const sorted = [...allCharacters].sort((a, b) =>
      Number(
        formatEther(
          (b.externalGoldBalance + b.escrowGoldBalance) -
          (a.externalGoldBalance + a.escrowGoldBalance),
        ),
      ),
    );

    const index = sorted.findIndex(c => c.id === character.id);
    return index === -1 ? 0 : index + 1;
  }, [allCharacters, character]);

  // Persist rank to localStorage whenever it changes
  useEffect(() => {
    if (rank === 0) return;

    if (!initializedRef.current) {
      // On first calculation, set previousRank from localStorage (already done in useState)
      initializedRef.current = true;
    } else {
      // On subsequent changes, the "previous" is whatever was stored
      const stored = localStorage.getItem(LB_GOLD_RANK_KEY);
      if (stored) {
        setPreviousRank(parseInt(stored, 10));
      }
    }

    localStorage.setItem(LB_GOLD_RANK_KEY, rank.toString());
  }, [rank]);

  const delta = useMemo(() => {
    if (!previousRank || rank === 0) return 0;
    // Negative delta = improved (lower rank number = better)
    return previousRank - rank;
  }, [previousRank, rank]);

  return { delta, previousRank, rank };
};
