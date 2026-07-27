import type { Spell, StatRestrictions, Weapon } from './types';

export type AttackPresentation = 'melee' | 'ranged' | 'spell';

/**
 * Classify an attack for text callouts and sound selection.
 * This is semantic combat feedback; it has no visual-asset dependency.
 */
export function classifyAttack(
  item: Weapon | Spell,
  isSpell: boolean,
): AttackPresentation {
  if (isSpell) return 'spell';
  const restrictions = (item as Weapon).statRestrictions as
    | StatRestrictions
    | undefined;
  if (!restrictions) return 'melee';

  const strength = Number(restrictions.minStrength);
  const agility = Number(restrictions.minAgility);
  const intelligence = Number(restrictions.minIntelligence);

  if (intelligence >= strength && intelligence >= agility) return 'spell';
  if (agility >= strength) return 'ranged';
  return 'melee';
}
