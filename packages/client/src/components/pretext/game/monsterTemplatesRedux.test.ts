import { describe, expect, it } from 'vitest';

import { asGLBDrawFn } from './glbCreatureLoader';
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

  // The battle scene preload loop in BattleSceneCanvas iterates these
  // templates and loads every unique GLB URL it finds. If a new GLB-backed
  // monster is added without its draw fn exposing a `glbUrl`, the preload
  // silently skips it and the player sees the procedural fallback until the
  // GLB lazily loads mid-battle — the "old spider that refreshes" bug we
  // just fixed. This test guards the contract.
  it('exposes a glbUrl on every dynamic GLB-backed template', () => {
    const expectedGLB = new Map<string, string>([
      ['Dire Rat', '/models/creatures/dire-rat.glb'],
      ['Kobold', '/models/creatures/kobold.glb'],
      ['Goblin', '/models/creatures/goblin.glb'],
      ['Giant Spider', '/models/creatures/giant-spider.glb'],
      ['Skeleton', '/models/creatures/skeleton.glb'],
      ['Goblin Shaman', '/models/creatures/goblin-shaman.glb'],
      ['Bugbear', '/models/creatures/bugbear.glb'],
      ['Hook Horror', '/models/creatures/hook-horror.glb'],
      ['Basilisk', '/models/creatures/basilisk.glb'],
    ]);
    for (const [name, expectedUrl] of expectedGLB) {
      const tpl = MONSTER_TEMPLATES_REDUX.find((t) => t.name === name);
      expect(tpl, `${name} template should exist`).toBeDefined();
      const glb = asGLBDrawFn(tpl?.draw);
      expect(glb, `${name} draw fn should narrow to GLBDrawFn`).not.toBeNull();
      expect(glb?.glbUrl).toBe(expectedUrl);
      expect(glb?.glbGridW).toBe(tpl?.gridWidth);
      expect(glb?.glbGridH).toBe(tpl?.gridHeight);
    }
  });

  it('keeps ASCII-only templates out of the GLB preload set', () => {
    const asciiOnly = ['Gelatinous Ooze', 'Carrion Crawler'];
    for (const name of asciiOnly) {
      const tpl = MONSTER_TEMPLATES_REDUX.find((t) => t.name === name);
      expect(tpl, `${name} template should exist`).toBeDefined();
      expect(asGLBDrawFn(tpl?.draw)).toBeNull();
    }
  });

  it('has no duplicate GLB URLs in the preload set', () => {
    const seen = new Set<string>();
    for (const tpl of MONSTER_TEMPLATES_REDUX) {
      const glb = asGLBDrawFn(tpl.draw);
      if (!glb) continue;
      expect(seen.has(glb.glbUrl), `${tpl.name} duplicates ${glb.glbUrl}`).toBe(false);
      seen.add(glb.glbUrl);
    }
  });
});
