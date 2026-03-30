import { describe, it, expect } from 'vitest';
import { NPC_NARRATIVES, type NpcNarrative } from './npcNarratives';

describe('npcNarratives', () => {
  const allKeys = Object.keys(NPC_NARRATIVES);

  it('exports narratives for all 6 NPCs/world objects', () => {
    expect(allKeys).toHaveLength(6);
    expect(allKeys).toContain('npc:vel_morrow');
    expect(allKeys).toContain('npc:edric_thorne');
    expect(allKeys).toContain('worldobj:camp_journal');
    expect(allKeys).toContain('worldobj:shrine_inscriptions');
    expect(allKeys).toContain('worldobj:edric_at_shrine');
    expect(allKeys).toContain('worldobj:summit_stone');
  });

  it('every narrative has a non-empty title and defaultFlavor', () => {
    for (const [key, nar] of Object.entries(NPC_NARRATIVES)) {
      expect(nar.title, `${key} missing title`).toBeTruthy();
      expect(nar.defaultFlavor, `${key} missing defaultFlavor`).toBeTruthy();
    }
  });

  it('every chainFlavor entry has a non-empty string', () => {
    for (const [key, nar] of Object.entries(NPC_NARRATIVES)) {
      for (const [fragType, steps] of Object.entries(nar.chainFlavors)) {
        for (const [step, text] of Object.entries(steps)) {
          expect(text, `${key} fragType=${fragType} step=${step} is empty`).toBeTruthy();
          expect(typeof text).toBe('string');
        }
      }
    }
  });

  it('Vel has chain flavors for fragments 10, 11, 12', () => {
    const vel = NPC_NARRATIVES['npc:vel_morrow'];
    expect(Object.keys(vel.chainFlavors).map(Number).sort()).toEqual([10, 11, 12]);
  });

  it('Edric has chain flavors for fragments 13, 14, 15', () => {
    const edric = NPC_NARRATIVES['npc:edric_thorne'];
    expect(Object.keys(edric.chainFlavors).map(Number).sort()).toEqual([13, 14, 15]);
  });

  it('world objects each have exactly one chain flavor entry', () => {
    const worldObjKeys = allKeys.filter(k => k.startsWith('worldobj:'));
    for (const key of worldObjKeys) {
      const nar = NPC_NARRATIVES[key];
      const fragTypes = Object.keys(nar.chainFlavors);
      expect(fragTypes.length, `${key} should have 1 chain flavor`).toBe(1);
    }
  });

  it('returns undefined for unknown metadataUri', () => {
    expect(NPC_NARRATIVES['npc:nonexistent']).toBeUndefined();
  });
});
