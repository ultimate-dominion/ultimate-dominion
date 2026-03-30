/** Shared Z2 fragment chain data — used by FragmentChainProgress and CurrentObjectiveHud */

export const CHAIN_NAMES: Record<number, string> = {
  9: 'The Ascent',
  10: "Vel's Warning",
  11: 'The Orders',
  12: 'What She Left Behind',
  13: 'The Shrine',
  14: "The Heretic's Question",
  15: 'Bones of Faith',
  16: "The Wind's Memory",
};

export const STEP_OBJECTIVES: Record<number, string[]> = {
  9: ['Arrive at Windy Peaks'],
  10: ['Talk to Vel', 'Kill a Covenant Scout'],
  11: ['Kill a Covenant Tracker', 'Bring the Sealed Letter to Vel'],
  12: ['Find the abandoned camp', 'Examine the camp journal', 'Talk to Vel'],
  13: ['Discover the ruined shrine', 'Kill the Fraying Guardian', 'Read the shrine inscriptions'],
  14: ['Talk to Edric', 'Meet Edric at the shrine'],
  15: ['Discover the Ossuary', 'Kill the Ossuary Guardian', 'Bring the Last Sermon to Edric'],
  16: ['Reach the Summit', 'Survive the Gale Fury', 'Examine the Summit Stone'],
};

export type Arc = {
  name: string;
  color: string;
  types: number[];
};

export const ARCS: Arc[] = [
  { name: 'The Peaks', color: '#8BA4B4', types: [9, 16] },
  { name: "Vel's Shadow", color: '#B47A5A', types: [10, 11, 12] },
  { name: "Edric's Trial", color: '#7A9B6E', types: [13, 14, 15] },
];

export const Z2_FRAGMENT_TYPES = [9, 10, 11, 12, 13, 14, 15, 16];
export const FRAGMENT_XVI_PREREQ = 4;
