/**
 * Single source of truth for class-spell deployment and client display.
 *
 * Both `packages/client/src/contexts/ItemsContext.tsx` (SPELL_CATALOG, which
 * drives UI names/damage) and `packages/contracts/scripts/admin/deploy-spell-items.ts`
 * (which on-chain deploys the spell Weapon items) derive their lists from
 * this file.
 *
 * Keeping both in one place makes it structurally impossible to add a new
 * class spell without updating both consumers — if you edit this manifest,
 * the deploy script and the UI catalog both move in lockstep.
 *
 * Damage values mirror `zones/dark_cave/spells.json` (L10) and
 * `zones/windy_peaks/spells.json` (L15). When those source files change,
 * update this manifest in the same commit.
 */

export interface SpellTier {
  effectName: string;
  displayName: string;
  minDamage: bigint;
  maxDamage: bigint;
}

export interface SpellManifestEntry {
  className: string;
  l10: SpellTier;
  l15: SpellTier;
}

export const SPELLS_MANIFEST: SpellManifestEntry[] = [
  {
    className: 'Warrior',
    l10: { effectName: 'battle_cry',          displayName: 'Battle Cry',      minDamage: 5n,  maxDamage: 10n },
    l15: { effectName: 'warcry',              displayName: 'Warcry',          minDamage: 8n,  maxDamage: 14n },
  },
  {
    className: 'Paladin',
    l10: { effectName: 'divine_shield',       displayName: 'Divine Shield',   minDamage: 0n,  maxDamage: 0n  },
    l15: { effectName: 'judgment',            displayName: 'Judgment',        minDamage: 6n,  maxDamage: 12n },
  },
  {
    className: 'Ranger',
    l10: { effectName: 'hunters_mark',        displayName: 'Marked Shot',     minDamage: 4n,  maxDamage: 8n  },
    l15: { effectName: 'volley',              displayName: 'Volley',          minDamage: 7n,  maxDamage: 14n },
  },
  {
    className: 'Rogue',
    l10: { effectName: 'shadowstep',          displayName: 'Expose Weakness', minDamage: 4n,  maxDamage: 8n  },
    l15: { effectName: 'backstab',            displayName: 'Backstab',        minDamage: 10n, maxDamage: 18n },
  },
  {
    className: 'Druid',
    l10: { effectName: 'entangle',            displayName: 'Entangle',        minDamage: 3n,  maxDamage: 6n  },
    l15: { effectName: 'regrowth',            displayName: 'Regrowth',        minDamage: 0n,  maxDamage: 0n  },
  },
  {
    className: 'Warlock',
    l10: { effectName: 'soul_drain_curse',    displayName: 'Soul Drain',      minDamage: 4n,  maxDamage: 8n  },
    l15: { effectName: 'blight',              displayName: 'Blight',          minDamage: 5n,  maxDamage: 10n },
  },
  {
    className: 'Wizard',
    l10: { effectName: 'arcane_blast_damage', displayName: 'Arcane Blast',    minDamage: 5n,  maxDamage: 10n },
    l15: { effectName: 'meteor',              displayName: 'Meteor',          minDamage: 8n,  maxDamage: 16n },
  },
  {
    className: 'Sorcerer',
    l10: { effectName: 'arcane_surge_damage', displayName: 'Arcane Infusion', minDamage: 3n,  maxDamage: 6n  },
    l15: { effectName: 'mana_burn',           displayName: 'Mana Burn',       minDamage: 5n,  maxDamage: 10n },
  },
  {
    className: 'Cleric',
    l10: { effectName: 'blessing',            displayName: 'Blessing',        minDamage: 0n,  maxDamage: 0n  },
    l15: { effectName: 'smite',               displayName: 'Smite',           minDamage: 5n,  maxDamage: 10n },
  },
];

/**
 * Flattened catalog map keyed by effectName. Both L10 and L15 tiers land in
 * the same map — effectNames are unique across the manifest.
 */
export const SPELL_CATALOG: Record<string, { name: string; minDamage: bigint; maxDamage: bigint; minLevel: bigint }> =
  Object.fromEntries(
    SPELLS_MANIFEST.flatMap((entry) => [
      [entry.l10.effectName, {
        name: entry.l10.displayName,
        minDamage: entry.l10.minDamage,
        maxDamage: entry.l10.maxDamage,
        minLevel: 10n,
      }],
      [entry.l15.effectName, {
        name: entry.l15.displayName,
        minDamage: entry.l15.minDamage,
        maxDamage: entry.l15.maxDamage,
        minLevel: 15n,
      }],
    ]),
  );
