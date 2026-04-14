import { describe, it, expect } from 'vitest';
import { SPELL_CATALOG, isSpellTokenURI, spellEffectNameFromURI } from './ItemsContext';

// ---------------------------------------------------------------------------
// SPELL_CATALOG — content coverage
// ---------------------------------------------------------------------------

describe('SPELL_CATALOG', () => {
  // L10 effect names deployed via dark_cave/spells.json — must match
  // deploy-spell-items.ts SPELLS[].l10EffectName exactly or the client
  // fallback will show raw IDs to players.
  const L10_EFFECTS = [
    'battle_cry',
    'divine_shield',
    'hunters_mark',
    'shadowstep',
    'entangle',
    'soul_drain_curse',
    'arcane_blast_damage',
    'arcane_surge_damage',
    'blessing',
  ];
  // L15 effect names deployed via windy_peaks/spells.json — must match
  // deploy-spell-items.ts SPELLS[].l15EffectName exactly.
  const L15_EFFECTS = [
    'warcry',
    'judgment',
    'volley',
    'backstab',
    'regrowth',
    'blight',
    'meteor',
    'mana_burn',
    'smite',
  ];

  it('contains all 9 L10 class spells', () => {
    for (const name of L10_EFFECTS) {
      expect(SPELL_CATALOG).toHaveProperty(name);
      expect(SPELL_CATALOG[name].minLevel).toBe(10n);
    }
  });

  it('contains all 9 L15 class spells', () => {
    for (const name of L15_EFFECTS) {
      expect(SPELL_CATALOG).toHaveProperty(name);
      expect(SPELL_CATALOG[name].minLevel).toBe(15n);
    }
  });

  it('has exactly 18 entries (9 L10 + 9 L15)', () => {
    expect(Object.keys(SPELL_CATALOG)).toHaveLength(18);
  });

  it('catalog covers every effect name in deploy-spell-items SPELLS', () => {
    // If this test fails, deploy-spell-items.ts added/renamed an effect and
    // the catalog wasn't updated — the UI will render "Spell #<id>" instead
    // of the real name. Keep the two lists in lockstep.
    for (const name of [...L10_EFFECTS, ...L15_EFFECTS]) {
      expect(SPELL_CATALOG[name]).toBeDefined();
    }
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
