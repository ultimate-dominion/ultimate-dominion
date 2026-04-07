/**
 * NPC narrative structure — maps metadataUri to chain flavor structure.
 * Text content lives in narrative.json locale files under the "npc" key.
 */

export type NpcNarrative = {
  title: string;
  defaultFlavor: string;
  /** Keyed by fragmentType, then stepIndex within that chain */
  chainFlavors: Record<number, Record<number, string>>;
};

/** Maps metadataUri → i18n key prefix + which chains/steps have flavors */
export const NPC_CHAIN_STRUCTURE: Record<string, { npcKey: string; chains: Record<number, number[]> }> = {
  'npc:vel_morrow': {
    npcKey: 'vel_morrow',
    chains: { 10: [0, 1], 11: [0, 1], 12: [0, 1, 2] },
  },
  'npc:edric_thorne': {
    npcKey: 'edric_thorne',
    chains: { 13: [0, 1, 2], 14: [0, 1], 15: [0, 1, 2] },
  },
  'worldobj:camp_journal': {
    npcKey: 'camp_journal',
    chains: { 12: [1] },
  },
  'worldobj:shrine_inscriptions': {
    npcKey: 'shrine_inscriptions',
    chains: { 13: [2] },
  },
  'worldobj:edric_at_shrine': {
    npcKey: 'edric_at_shrine',
    chains: { 14: [1] },
  },
  'worldobj:summit_stone': {
    npcKey: 'summit_stone',
    chains: { 16: [2] },
  },
};
