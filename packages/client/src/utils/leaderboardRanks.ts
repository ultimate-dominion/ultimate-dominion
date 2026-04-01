import { type Character } from './types';

export type RankResult = {
  statsRank: number;
  goldRank: number;
  totalPlayers: number;
};

/**
 * Compute a character's stats rank and gold rank among all characters.
 * Stats rank: sorted by sum of base agility + strength + intelligence (desc).
 * Gold rank: sorted by gold balance (desc, bigint comparison).
 * Ties share the same rank; later ranks include gaps because they are based on
 * how many players sit strictly above the target.
 */
export const computeRanks = (
  allCharacters: Character[],
  characterId: string | undefined,
): RankResult | null => {
  if (!characterId || allCharacters.length === 0) return null;

  const target = allCharacters.find(c => c.id === characterId);
  if (!target) return null;

  const totalStats = (c: Character): bigint =>
    c.agility + c.strength + c.intelligence;

  const targetStats = totalStats(target);
  const targetGold = target.externalGoldBalance;

  // Count how many players have strictly higher stats/gold = rank - 1
  let statsAbove = 0;
  let goldAbove = 0;

  for (const c of allCharacters) {
    if (totalStats(c) > targetStats) statsAbove++;
    if (c.externalGoldBalance > targetGold) goldAbove++;
  }

  return {
    statsRank: statsAbove + 1,
    goldRank: goldAbove + 1,
    totalPlayers: allCharacters.length,
  };
};
