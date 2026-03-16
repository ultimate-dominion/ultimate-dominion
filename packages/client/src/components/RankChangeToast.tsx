import { useToast } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { useLeaderboardRank } from '../hooks/useLeaderboardRank';

const THROTTLE_MS = 5000;

export const RankChangeToast = (): null => {
  const toast = useToast();
  const rank = useLeaderboardRank();
  const lastToastTime = useRef(0);

  // Track previous deltas to only fire on change
  const prevStatsRankDelta = useRef(0);
  const prevGoldRankDelta = useRef(0);

  useEffect(() => {
    if (!rank) return;

    const { statsRankDelta, goldRankDelta, statsRank, goldRank } = rank;

    // Only fire when delta actually changes from what we last saw
    const statsChanged = statsRankDelta !== 0 && statsRankDelta !== prevStatsRankDelta.current;
    const goldChanged = goldRankDelta !== 0 && goldRankDelta !== prevGoldRankDelta.current;

    prevStatsRankDelta.current = statsRankDelta;
    prevGoldRankDelta.current = goldRankDelta;

    if (!statsChanged && !goldChanged) return;

    const now = Date.now();
    if (now - lastToastTime.current < THROTTLE_MS) return;
    lastToastTime.current = now;

    if (statsChanged && statsRankDelta !== 0) {
      const arrow = statsRankDelta > 0 ? '\u25B2' : '\u25BC';
      const prevRank = statsRank - statsRankDelta;
      toast({
        description: `Stats Rank: #${prevRank} \u2192 #${statsRank} ${arrow}${Math.abs(statsRankDelta)}`,
        status: statsRankDelta > 0 ? 'success' : 'warning',
        position: 'bottom-right',
        duration: 3500,
        isClosable: true,
      });
    }

    if (goldChanged && goldRankDelta !== 0) {
      const arrow = goldRankDelta > 0 ? '\u25B2' : '\u25BC';
      const prevRank = goldRank - goldRankDelta;
      toast({
        description: `Gold Rank: #${prevRank} \u2192 #${goldRank} ${arrow}${Math.abs(goldRankDelta)}`,
        status: goldRankDelta > 0 ? 'success' : 'warning',
        position: 'bottom-right',
        duration: 3500,
        isClosable: true,
      });
    }
  }, [rank, toast]);

  return null;
};
