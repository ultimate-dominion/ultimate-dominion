import { describe, expect, it } from 'vitest';

import { classifyAttack } from './attackPresentation';

describe('classifyAttack', () => {
  it('classifies every spell without consulting artwork', () => {
    expect(classifyAttack({ name: 'Future Spell' } as never, true)).toBe(
      'spell',
    );
  });

  it('classifies unknown weapons safely as melee', () => {
    expect(classifyAttack({ name: 'Future Weapon' } as never, false)).toBe(
      'melee',
    );
  });

  it('uses dominant requirements for sound and text feedback', () => {
    expect(
      classifyAttack(
        {
          statRestrictions: {
            minStrength: 1n,
            minAgility: 8n,
            minIntelligence: 2n,
          },
        } as never,
        false,
      ),
    ).toBe('ranged');
  });
});
