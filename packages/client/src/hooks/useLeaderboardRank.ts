import { useEffect, useMemo, useRef, useState } from 'react';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { computeRanks, type RankResult } from '../utils/leaderboardRanks';

export type LeaderboardRankResult = RankResult & {
  statsRankDelta: number;
  goldRankDelta: number;
};

const DEBOUNCE_MS = 1000;
const DELTA_CLEAR_MS = 5000;

export const useLeaderboardRank = (): LeaderboardRankResult | null => {
  const { allCharacters } = useMap();
  const { character } = useCharacter();

  const rawRanks = useMemo(
    () => computeRanks(allCharacters, character?.id),
    [allCharacters, character?.id],
  );

  // Debounced "settled" rank — waits for rapid updates to stop
  const [settled, setSettled] = useState<RankResult | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!rawRanks) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      setSettled(prev => {
        // Only update if rank actually changed
        if (
          prev &&
          prev.statsRank === rawRanks.statsRank &&
          prev.goldRank === rawRanks.goldRank &&
          prev.totalPlayers === rawRanks.totalPlayers
        ) {
          return prev;
        }
        return rawRanks;
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [rawRanks]);

  // Track previous settled rank to compute deltas
  const prevSettled = useRef<RankResult | null>(null);
  const [statsRankDelta, setStatsRankDelta] = useState(0);
  const [goldRankDelta, setGoldRankDelta] = useState(0);
  const deltaClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!settled) return;

    if (prevSettled.current) {
      const sDelta = prevSettled.current.statsRank - settled.statsRank;
      const gDelta = prevSettled.current.goldRank - settled.goldRank;

      if (sDelta !== 0 || gDelta !== 0) {
        setStatsRankDelta(sDelta);
        setGoldRankDelta(gDelta);

        if (deltaClearTimer.current) clearTimeout(deltaClearTimer.current);
        deltaClearTimer.current = setTimeout(() => {
          setStatsRankDelta(0);
          setGoldRankDelta(0);
        }, DELTA_CLEAR_MS);
      }
    }

    prevSettled.current = settled;

    return () => {
      if (deltaClearTimer.current) clearTimeout(deltaClearTimer.current);
    };
  }, [settled]);

  if (!settled) return null;

  return {
    ...settled,
    statsRankDelta,
    goldRankDelta,
  };
};
