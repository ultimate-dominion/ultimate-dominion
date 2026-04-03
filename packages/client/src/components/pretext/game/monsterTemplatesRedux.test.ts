import { describe, expect, it } from 'vitest';

import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';

describe('MONSTER_TEMPLATES_REDUX', () => {
  it('renders Giant Spider with the spider template instead of the crystal elemental art', () => {
    const giantSpider = MONSTER_TEMPLATES_REDUX.find((template) => template.name === 'Giant Spider');

    expect(giantSpider).toBeDefined();
    expect(giantSpider?.draw.name).toBe('drawPhaseSpiderRedux');
  });

  it('uses dedicated dark cave monster art instead of stand-in templates', () => {
    const expectations = new Map([
      ['Skeleton', 'drawSkeletonRedux'],
      ['Goblin Shaman', 'drawGoblinShamanRedux'],
      ['Gelatinous Ooze', 'drawGelatinousOozeRedux'],
      ['Bugbear', 'drawBugbearRedux'],
      ['Carrion Crawler', 'drawCarrionCrawlerRedux'],
    ]);

    for (const [monsterName, drawName] of expectations) {
      const template = MONSTER_TEMPLATES_REDUX.find((entry) => entry.name === monsterName);

      expect(template, `${monsterName} template should exist`).toBeDefined();
      expect(template?.draw.name).toBe(drawName);
    }
  });
});
