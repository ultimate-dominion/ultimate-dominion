import { describe, expect, it } from 'vitest';

import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';

describe('MONSTER_TEMPLATES_REDUX', () => {
  it('renders Giant Spider with the spider template instead of the crystal elemental art', () => {
    const giantSpider = MONSTER_TEMPLATES_REDUX.find((template) => template.name === 'Giant Spider');

    expect(giantSpider).toBeDefined();
    expect(giantSpider?.draw.name).toBe('drawPhaseSpiderRedux');
  });
});
