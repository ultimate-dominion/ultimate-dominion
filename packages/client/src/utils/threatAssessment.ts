/**
 * Get the dominant stat (highest of STR/AGI/INT) — mirrors the on-chain
 * _getDominantStat logic in CombatSystem.sol.
 *
 * Returns: [dominantIndex (0=STR, 1=AGI, 2=INT), dominantValue]
 */
export const getDominantStat = (
  stats: { strength: bigint; agility: bigint; intelligence: bigint },
): [number, bigint] => {
  if (stats.strength >= stats.agility && stats.strength >= stats.intelligence) {
    return [0, stats.strength];
  }
  if (stats.agility > stats.strength && stats.agility >= stats.intelligence) {
    return [1, stats.agility];
  }
  return [2, stats.intelligence];
};

/**
 * Honest threat assessment comparing player vs opponent.
 *
 * Factors: level difference, total stat power, HP pools, armor, elite status,
 * and combat triangle. Returns 'green' (favored), 'yellow' (even), 'red' (tough).
 */
export const getThreatColor = (
  player: { strength: bigint; agility: bigint; intelligence: bigint; level: bigint; maxHp: bigint },
  opponent: { strength: bigint; agility: bigint; intelligence: bigint; level?: bigint; maxHp?: bigint; armor?: bigint; isElite?: boolean },
): string => {
  if (
    opponent.strength == null ||
    opponent.agility == null ||
    opponent.intelligence == null
  ) {
    return 'yellow';
  }

  const pStr = Number(player.strength);
  const pAgi = Number(player.agility);
  const pInt = Number(player.intelligence);
  const pLevel = Number(player.level);
  const pHp = Number(player.maxHp);

  const oStr = Number(opponent.strength);
  const oAgi = Number(opponent.agility);
  const oInt = Number(opponent.intelligence);
  const oLevel = Number(opponent.level ?? 1n);
  const oHp = Number(opponent.maxHp ?? 10n);
  const oArmor = Number(opponent.armor ?? 0n);
  const isElite = opponent.isElite ?? false;

  // Total stat power (offensive + defensive)
  const pStatTotal = pStr + pAgi + pInt;
  const oStatTotal = oStr + oAgi + oInt;

  // Combat triangle modifier
  const [playerDom] = getDominantStat(player);
  const [opponentDom] = getDominantStat(opponent);
  const playerBeatsOpponent =
    (playerDom === 0 && opponentDom === 1) ||
    (playerDom === 1 && opponentDom === 2) ||
    (playerDom === 2 && opponentDom === 0);
  const opponentBeatsPlayer =
    (opponentDom === 0 && playerDom === 1) ||
    (opponentDom === 1 && playerDom === 2) ||
    (opponentDom === 2 && playerDom === 0);

  let triangleMod = 1.0;
  if (playerBeatsOpponent) triangleMod = 1.2;
  else if (opponentBeatsPlayer) triangleMod = 0.8;

  // Power score: stats, HP, level, armor, elite penalty
  const pPower = (pStatTotal * 2 + pHp + pLevel * 3) * triangleMod;
  const oPower = oStatTotal * 2 + oHp + oLevel * 3 + oArmor * 5 + (isElite ? oLevel * 3 : 0);

  const ratio = pPower / oPower;

  if (ratio >= 1.4) return 'green';
  if (ratio <= 0.75) return 'red';
  return 'yellow';
};
