import { describe, expect, it } from 'vitest';

import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';

describe('MONSTER_TEMPLATES_REDUX', () => {
  it('renders Giant Spider with GLB model and canvas fallback', () => {
    const giantSpider = MONSTER_TEMPLATES_REDUX.find((template) => template.name === 'Giant Spider');

    expect(giantSpider).toBeDefined();
    expect(giantSpider?.dynamic).toBe(true);
    expect(giantSpider?.draw.name).toBe('drawGLBCreature');
  });

  it('uses dedicated dark cave monster art instead of stand-in templates', () => {
    // GLB-backed creatures use makeGLBDrawFn wrapper (dynamic: true)
    const glbCreatures = ['Skeleton', 'Goblin Shaman', 'Bugbear'];
    for (const name of glbCreatures) {
      const template = MONSTER_TEMPLATES_REDUX.find((entry) => entry.name === name);
      expect(template, `${name} template should exist`).toBeDefined();
      expect(template?.dynamic, `${name} should be dynamic (GLB)`).toBe(true);
    }

    // Canvas-only creatures use direct draw functions
    const canvasCreatures = new Map([
      ['Gelatinous Ooze', 'drawGelatinousOozeRedux'],
      ['Carrion Crawler', 'drawCarrionCrawlerRedux'],
    ]);
    for (const [monsterName, drawName] of canvasCreatures) {
      const template = MONSTER_TEMPLATES_REDUX.find((entry) => entry.name === monsterName);
      expect(template, `${monsterName} template should exist`).toBeDefined();
      expect(template?.draw.name).toBe(drawName);
    }
  });
});
