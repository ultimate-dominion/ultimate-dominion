/**
 * Fragment Narratives — shared constants
 * Narrative content lives in narrative.json locale files.
 */

export type FragmentInfo = {
  id: number;
  name: string;
  narrative: string;
  hint: string;
};

export const TOTAL_FRAGMENTS = 8;

export const getRomanNumeral = (num: number): string => {
  const numerals: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
    11: 'XI',
    12: 'XII',
    13: 'XIII',
    14: 'XIV',
    15: 'XV',
    16: 'XVI',
  };
  return numerals[num] ?? num.toString();
};
