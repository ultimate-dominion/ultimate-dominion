import { describe, it, expect } from 'vitest';
import { SPELLS_MANIFEST } from '../data/spellsManifest';
import { SPELL_CATALOG, isSpellTokenURI, spellEffectNameFromURI } from './ItemsContext';

// ---------------------------------------------------------------------------
// SPELL_CATALOG — content coverage
// ---------------------------------------------------------------------------

describe('SPELL_CATALOG', () => {
  // The manifest is the single source of truth for both the deploy script
  // (packages/contracts/scripts/admin/deploy-spell-items.ts) and the client
  // catalog. Deriving the expected effect names here means the test moves
  // in lockstep with the deploy script automatically — no manual edits to
  // keep two lists in sync.
  const L10_EFFECTS = SPELLS_MANIFEST.map((s) => s.l10.effectName);
  const L15_EFFECTS = SPELLS_MANIFEST.map((s) => s.l15.effectName);

  it('contains every L10 class spell from the manifest', () => {
    expect(L10_EFFECTS).toHaveLength(9);
    for (const name of L10_EFFECTS) {
      expect(SPELL_CATALOG).toHaveProperty(name);
      expect(SPELL_CATALOG[name].minLevel).toBe(10n);
    }
  });

  it('contains every L15 class spell from the manifest', () => {
    expect(L15_EFFECTS).toHaveLength(9);
    for (const name of L15_EFFECTS) {
      expect(SPELL_CATALOG).toHaveProperty(name);
      expect(SPELL_CATALOG[name].minLevel).toBe(15n);
    }
  });

  it('has exactly 2x manifest entries (one per tier)', () => {
    expect(Object.keys(SPELL_CATALOG)).toHaveLength(SPELLS_MANIFEST.length * 2);
  });

  it('catalog names and damage match the manifest exactly', () => {
    for (const entry of SPELLS_MANIFEST) {
      const l10 = SPELL_CATALOG[entry.l10.effectName];
      expect(l10.name).toBe(entry.l10.displayName);
      expect(l10.minDamage).toBe(entry.l10.minDamage);
      expect(l10.maxDamage).toBe(entry.l10.maxDamage);
      const l15 = SPELL_CATALOG[entry.l15.effectName];
      expect(l15.name).toBe(entry.l15.displayName);
      expect(l15.minDamage).toBe(entry.l15.minDamage);
      expect(l15.maxDamage).toBe(entry.l15.maxDamage);
    }
  });

  it('effect names are unique across all tiers (no collisions)', () => {
    const all = [...L10_EFFECTS, ...L15_EFFECTS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('Arcane Infusion has correct display name and damage', () => {
    const entry = SPELL_CATALOG['arcane_surge_damage'];
    expect(entry.name).toBe('Arcane Infusion');
    expect(entry.minDamage).toBe(3n);
    expect(entry.maxDamage).toBe(6n);
    expect(entry.minLevel).toBe(10n);
  });

  it('Battle Cry has correct display name and damage', () => {
    const entry = SPELL_CATALOG['battle_cry'];
    expect(entry.name).toBe('Battle Cry');
    expect(entry.minDamage).toBe(5n);
    expect(entry.maxDamage).toBe(10n);
  });

  it('Backstab L15 has correct damage', () => {
    const entry = SPELL_CATALOG['backstab'];
    expect(entry.name).toBe('Backstab');
    expect(entry.minDamage).toBe(10n);
    expect(entry.maxDamage).toBe(18n);
    expect(entry.minLevel).toBe(15n);
  });

  it('Meteor L15 has correct damage', () => {
    const entry = SPELL_CATALOG['meteor'];
    expect(entry.name).toBe('Meteor');
    expect(entry.minDamage).toBe(8n);
    expect(entry.maxDamage).toBe(16n);
    expect(entry.minLevel).toBe(15n);
  });

  it('L10 utility spells have 0 damage', () => {
    expect(SPELL_CATALOG['divine_shield'].minDamage).toBe(0n);
    expect(SPELL_CATALOG['divine_shield'].maxDamage).toBe(0n);
    expect(SPELL_CATALOG['blessing'].minDamage).toBe(0n);
    expect(SPELL_CATALOG['blessing'].maxDamage).toBe(0n);
  });

  it('L15 utility spell Regrowth has 0 damage', () => {
    expect(SPELL_CATALOG['regrowth'].minDamage).toBe(0n);
    expect(SPELL_CATALOG['regrowth'].maxDamage).toBe(0n);
  });

  it('returns undefined for unknown effect names (miss behavior)', () => {
    // Callers rely on ?? fallbacks when the effect name isn't in the
    // catalog (new spell deployed without a client update). Make sure
    // that a miss returns undefined rather than, say, a shared default
    // that would masquerade as real data.
    expect(SPELL_CATALOG['not_a_real_spell']).toBeUndefined();
    expect(SPELL_CATALOG['']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isSpellTokenURI — spell URI detection
// ---------------------------------------------------------------------------

describe('isSpellTokenURI', () => {
  it('returns true for spell: URIs', () => {
    expect(isSpellTokenURI('spell:arcane_surge_damage')).toBe(true);
    expect(isSpellTokenURI('spell:battle_cry')).toBe(true);
    expect(isSpellTokenURI('spell:blessing')).toBe(true);
  });

  it('returns false for non-spell URIs', () => {
    expect(isSpellTokenURI('weapon:iron_sword')).toBe(false);
    expect(isSpellTokenURI('armor:tattered_cloth')).toBe(false);
    expect(isSpellTokenURI('consumable:health_potion')).toBe(false);
    expect(isSpellTokenURI('')).toBe(false);
    expect(isSpellTokenURI('https://example.com/metadata.json')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// spellEffectNameFromURI — effect name extraction
// ---------------------------------------------------------------------------

describe('spellEffectNameFromURI', () => {
  it('extracts effect name from spell: URI', () => {
    expect(spellEffectNameFromURI('spell:arcane_surge_damage')).toBe('arcane_surge_damage');
    expect(spellEffectNameFromURI('spell:battle_cry')).toBe('battle_cry');
  });

  it('returns null for non-spell URIs', () => {
    expect(spellEffectNameFromURI('weapon:iron_sword')).toBeNull();
    expect(spellEffectNameFromURI('')).toBeNull();
    expect(spellEffectNameFromURI('armor:tattered_cloth')).toBeNull();
  });

  it('catalog lookup works via extracted effect name', () => {
    const uri = 'spell:arcane_surge_damage';
    const effectName = spellEffectNameFromURI(uri);
    expect(effectName).not.toBeNull();
    const entry = SPELL_CATALOG[effectName!];
    expect(entry).toBeDefined();
    expect(entry.name).toBe('Arcane Infusion');
  });
});

// ---------------------------------------------------------------------------
// i18n sanity — advancedClass JSON has both UI and class-name keys
// ---------------------------------------------------------------------------

describe('ui.json advancedClass i18n keys', () => {
  // Load the JSON directly (not via i18next) to catch duplicate-key collisions
  // at the source, independent of runtime parser behaviour.
  const uiJson = require('../i18n/locales/en/ui.json');

  it('has chooseYourPath UI text key', () => {
    expect(uiJson.advancedClass.chooseYourPath).toBe('Choose Your Path');
  });

  it('has permanent UI text key', () => {
    expect(uiJson.advancedClass.permanent).toContain('permanent');
  });

  it('has notNow UI text key', () => {
    expect(uiJson.advancedClass.notNow).toBe('Not now');
  });

  it('has class name keys coexisting with UI keys', () => {
    expect(uiJson.advancedClass.paladin).toBe('Paladin');
    expect(uiJson.advancedClass.sorcerer).toBe('Sorcerer');
    expect(uiJson.advancedClass.warrior).toBe('Warrior');
    expect(uiJson.advancedClass.druid).toBe('Druid');
    expect(uiJson.advancedClass.warlock).toBe('Warlock');
    expect(uiJson.advancedClass.ranger).toBe('Ranger');
    expect(uiJson.advancedClass.cleric).toBe('Cleric');
    expect(uiJson.advancedClass.wizard).toBe('Wizard');
    expect(uiJson.advancedClass.rogue).toBe('Rogue');
  });

  it('does not have duplicate advancedClass keys (JSON deduplication check)', () => {
    // JSON.parse uses the last value for duplicate keys — if chooseYourPath
    // exists, the second (class-names-only) block did NOT overwrite the first.
    expect(uiJson.advancedClass.chooseYourPath).toBeDefined();
    expect(uiJson.advancedClass.paladin).toBeDefined();
  });
});
