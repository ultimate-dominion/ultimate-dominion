export interface LevelData {
  level: number;
  xpRequired: number;
  totalXp: number;
  statPoints: number;
  hpGain: number;
  unlock?: string;
}

// XP thresholds from on-chain Levels table (UpdateXpThresholds.s.sol)
// Values are cumulative thresholds; xpRequired is the delta per level
export const xpTable: LevelData[] = [
  { level: 1,  xpRequired: 5,       totalXp: 0,        statPoints: 1, hpGain: 2 },
  { level: 2,  xpRequired: 15,      totalXp: 5,        statPoints: 1, hpGain: 2 },
  { level: 3,  xpRequired: 35,      totalXp: 20,       statPoints: 1, hpGain: 2, unlock: 'Adventurer Badge + Chat' },
  { level: 4,  xpRequired: 195,     totalXp: 55,       statPoints: 1, hpGain: 2 },
  { level: 5,  xpRequired: 600,     totalXp: 250,      statPoints: 1, hpGain: 2, unlock: 'Power Source Bonus' },
  { level: 6,  xpRequired: 1_150,   totalXp: 850,      statPoints: 1, hpGain: 2 },
  { level: 7,  xpRequired: 2_500,   totalXp: 2_000,    statPoints: 1, hpGain: 2 },
  { level: 8,  xpRequired: 4_500,   totalXp: 4_500,    statPoints: 1, hpGain: 2 },
  { level: 9,  xpRequired: 7_000,   totalXp: 9_000,    statPoints: 1, hpGain: 2 },
  { level: 10, xpRequired: 9_000,   totalXp: 16_000,   statPoints: 1, hpGain: 2, unlock: 'Max Level + Class Selection' },
];

export const progressionRules = {
  statPointsPerLevel: [
    { range: '1\u201310', rate: '+1 per level' },
  ],
  hpPerLevel: [
    { range: '1\u201310', rate: '+2 per level' },
  ],
  totalFromLeveling: {
    statPoints: '10 stat points',
    hp: '20 HP (base)',
  },
};
