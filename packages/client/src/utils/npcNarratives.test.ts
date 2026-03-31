import { describe, it, expect } from 'vitest';
import { NPC_CHAIN_STRUCTURE } from './npcNarratives';

describe('npcNarratives', () => {
  const allKeys = Object.keys(NPC_CHAIN_STRUCTURE);

  it('exports structure for all 6 NPCs/world objects', () => {
    expect(allKeys).toHaveLength(6);
    expect(allKeys).toContain('npc:vel_morrow');
    expect(allKeys).toContain('npc:edric_thorne');
    expect(allKeys).toContain('worldobj:camp_journal');
    expect(allKeys).toContain('worldobj:shrine_inscriptions');
    expect(allKeys).toContain('worldobj:edric_at_shrine');
    expect(allKeys).toContain('worldobj:summit_stone');
  });

  it('every entry has a npcKey and at least one chain', () => {
    for (const [key, entry] of Object.entries(NPC_CHAIN_STRUCTURE)) {
      expect(entry.npcKey, `${key} missing npcKey`).toBeTruthy();
      expect(Object.keys(entry.chains).length, `${key} has no chains`).toBeGreaterThan(0);
    }
  });

  it('every chain has at least one step', () => {
    for (const [key, entry] of Object.entries(NPC_CHAIN_STRUCTURE)) {
      for (const [fragType, steps] of Object.entries(entry.chains)) {
        expect(steps.length, `${key} fragType=${fragType} has no steps`).toBeGreaterThan(0);
      }
    }
  });

  it('Vel has chain structure for fragments 10, 11, 12', () => {
    const vel = NPC_CHAIN_STRUCTURE['npc:vel_morrow'];
    expect(Object.keys(vel.chains).map(Number).sort()).toEqual([10, 11, 12]);
  });

  it('Edric has chain structure for fragments 13, 14, 15', () => {
    const edric = NPC_CHAIN_STRUCTURE['npc:edric_thorne'];
    expect(Object.keys(edric.chains).map(Number).sort()).toEqual([13, 14, 15]);
  });

  it('world objects each have exactly one chain entry', () => {
    const worldObjKeys = allKeys.filter(k => k.startsWith('worldobj:'));
    for (const key of worldObjKeys) {
      const entry = NPC_CHAIN_STRUCTURE[key];
      const fragTypes = Object.keys(entry.chains);
      expect(fragTypes.length, `${key} should have 1 chain`).toBe(1);
    }
  });

  it('returns undefined for unknown metadataUri', () => {
    expect(NPC_CHAIN_STRUCTURE['npc:nonexistent']).toBeUndefined();
  });
});
