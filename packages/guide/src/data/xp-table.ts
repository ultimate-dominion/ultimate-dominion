export interface LevelData {
  level: number;
  xpRequired: number;
  totalXp: number;
  statPoints: number;
  hpGain: number;
  unlock?: string;
}

// XP formula from GAME_DESIGN.md:
// L1: 300, L2: 900, L3: 2700, L5: 14000, L10: 85000
// MAX_LEVEL is 10
export const xpTable: LevelData[] = [
  { level: 1,  xpRequired: 300,     totalXp: 0,        statPoints: 1, hpGain: 2 },
  { level: 2,  xpRequired: 900,     totalXp: 300,      statPoints: 1, hpGain: 2 },
  { level: 3,  xpRequired: 2_700,   totalXp: 1_200,    statPoints: 1, hpGain: 2, unlock: 'Adventurer Badge + Chat' },
  { level: 4,  xpRequired: 6_500,   totalXp: 3_900,    statPoints: 1, hpGain: 2 },
  { level: 5,  xpRequired: 14_000,  totalXp: 10_400,   statPoints: 1, hpGain: 2, unlock: 'Power Source Bonus' },
  { level: 6,  xpRequired: 23_000,  totalXp: 24_400,   statPoints: 1, hpGain: 2 },
  { level: 7,  xpRequired: 34_000,  totalXp: 47_400,   statPoints: 1, hpGain: 2 },
  { level: 8,  xpRequired: 48_000,  totalXp: 81_400,   statPoints: 1, hpGain: 2 },
  { level: 9,  xpRequired: 64_000,  totalXp: 129_400,  statPoints: 1, hpGain: 2 },
  { level: 10, xpRequired: 85_000,  totalXp: 193_400,  statPoints: 1, hpGain: 2, unlock: 'Max Level' },
];

export const progressionRules = {
  statPointsPerLevel: [
    { range: '1–10', rate: '+1 per level' },
  ],
  hpPerLevel: [
    { range: '1–10', rate: '+2 per level' },
  ],
  totalFromLeveling: {
    statPoints: '10 stat points',
    hp: '20 HP (base)',
  },
};
