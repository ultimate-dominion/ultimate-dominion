import { describe, it, expect } from 'vitest';

import { CLASS_DATA, getClassBySlug, CLASS_SLUGS } from './classData';
import { AdvancedClass } from '../utils/types';

describe('classData', () => {
  it('contains all 9 classes', () => {
    expect(CLASS_DATA).toHaveLength(9);
  });

  it('every class has a unique slug', () => {
    const slugs = CLASS_DATA.map(c => c.slug);
    expect(new Set(slugs).size).toBe(9);
  });

  it('every class has a unique enumValue', () => {
    const enums = CLASS_DATA.map(c => c.enumValue);
    expect(new Set(enums).size).toBe(9);
  });

  it('no class uses AdvancedClass.None', () => {
    expect(CLASS_DATA.every(c => c.enumValue !== AdvancedClass.None)).toBe(true);
  });

  it('every class has required fields populated', () => {
    for (const c of CLASS_DATA) {
      expect(c.name).toBeTruthy();
      expect(c.slug).toBeTruthy();
      expect(c.color).toBeTruthy();
      expect(c.archetype).toBeTruthy();
      expect(c.flatBonuses).toBeTruthy();
      expect(c.spellName).toBeTruthy();
      expect(c.spellDesc).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.lore).toBeTruthy();
      expect(c.playstyle).toBeTruthy();
      expect(c.strengths.length).toBeGreaterThan(0);
      expect(c.weaknesses.length).toBeGreaterThan(0);
    }
  });

  it('slugs are lowercase versions of names', () => {
    for (const c of CLASS_DATA) {
      expect(c.slug).toBe(c.name.toLowerCase());
    }
  });

  it('every class has all multiplier fields', () => {
    for (const c of CLASS_DATA) {
      expect(c.multipliers.phys).toMatch(/^\d+%$/);
      expect(c.multipliers.spell).toMatch(/^\d+%$/);
      expect(c.multipliers.heal).toMatch(/^\d+%$/);
      expect(c.multipliers.crit).toMatch(/^\d+%$/);
      expect(c.multipliers.maxHp).toMatch(/^\d+%$/);
    }
  });

  describe('getClassBySlug', () => {
    it('finds a class by lowercase slug', () => {
      const warrior = getClassBySlug('warrior');
      expect(warrior).toBeDefined();
      expect(warrior!.name).toBe('Warrior');
      expect(warrior!.enumValue).toBe(AdvancedClass.Warrior);
    });

    it('is case-insensitive', () => {
      expect(getClassBySlug('Warrior')).toBeDefined();
      expect(getClassBySlug('WARRIOR')).toBeDefined();
    });

    it('returns undefined for invalid slug', () => {
      expect(getClassBySlug('barbarian')).toBeUndefined();
      expect(getClassBySlug('')).toBeUndefined();
    });

    it('finds all 9 classes', () => {
      for (const slug of CLASS_SLUGS) {
        expect(getClassBySlug(slug)).toBeDefined();
      }
    });
  });

  describe('CLASS_SLUGS', () => {
    it('has 9 entries', () => {
      expect(CLASS_SLUGS).toHaveLength(9);
    });

    it('matches all slugs from CLASS_DATA', () => {
      expect(CLASS_SLUGS).toEqual(CLASS_DATA.map(c => c.slug));
    });
  });

  describe('archetype distribution', () => {
    it('has classes in all archetypes', () => {
      const archetypes = new Set(CLASS_DATA.map(c => c.archetype));
      expect(archetypes).toContain('Strength');
      expect(archetypes).toContain('Agility');
      expect(archetypes).toContain('Intelligence');
      expect(archetypes).toContain('Hybrid');
    });
  });
});
