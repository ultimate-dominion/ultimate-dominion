import { useCallback, useEffect, useRef, useState } from 'react';
import { useCharacter } from '../contexts/CharacterContext';

const INDEXER_URL = (
  import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api'
).replace(/\/api\/?$/, '');

const POLL_INTERVAL_MS = 30_000;

export type NearbyPlayer = {
  characterId: string;
  name: string;
  level: number;
  totalStats: number;
  totalGold: string;
  statsRank: number;
  goldRank: number;
  isSelf: boolean;
};

export type NearbyRanksResult = {
  nearby: NearbyPlayer[];
  totalPlayers: number;
  selfStatsRank: number | null;
  selfGoldRank: number | null;
  isLoading: boolean;
  rankBy: 'stats' | 'gold';
  /** The rankBy mode the current data was fetched with */
  dataRankBy: 'stats' | 'gold';
  setRankBy: (mode: 'stats' | 'gold') => void;
};

export const useNearbyRanks = (): NearbyRanksResult => {
  const { character } = useCharacter();
  const [nearby, setNearby] = useState<NearbyPlayer[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [selfStatsRank, setSelfStatsRank] = useState<number | null>(null);
  const [selfGoldRank, setSelfGoldRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rankBy, setRankBy] = useState<'stats' | 'gold'>('gold');
  const [dataRankBy, setDataRankBy] = useState<'stats' | 'gold'>('gold');
  const hasLoadedOnce = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNearby = useCallback(async () => {
    if (!character?.id) return;

    try {
      const resp = await fetch(
        `${INDEXER_URL}/api/leaderboard/nearby?characterId=${character.id}&rankBy=${rankBy}`,
      );
      if (!resp.ok) return;

      const data = await resp.json();
      setNearby(data.nearby);
      setTotalPlayers(data.totalPlayers);
      setSelfStatsRank(data.selfStatsRank);
      setSelfGoldRank(data.selfGoldRank);
      setDataRankBy(data.rankBy ?? rankBy);
    } catch {
      // Silent — ambient data
    } finally {
      setIsLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [character?.id, rankBy]);

  useEffect(() => {
    if (!hasLoadedOnce.current) setIsLoading(true);
    fetchNearby();

    intervalRef.current = setInterval(fetchNearby, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNearby]);

  return {
    nearby,
    totalPlayers,
    selfStatsRank,
    selfGoldRank,
    isLoading,
    rankBy,
    dataRankBy,
    setRankBy,
  };
};
