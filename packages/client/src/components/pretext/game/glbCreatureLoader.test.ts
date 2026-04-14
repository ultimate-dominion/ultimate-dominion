import { describe, expect, it } from 'vitest';

import { asGLBDrawFn, makeGLBDrawFn } from './glbCreatureLoader';

// asGLBDrawFn is a duck-typed narrower used at module-load time by the
// battle scene preload loop. We don't want to pay the cost of actually
// loading a GLB (Three.js + WebGL + a GLTFLoader) in unit tests — we only
// need to verify the narrower correctly accepts GLBDrawFns produced by
// makeGLBDrawFn and rejects everything else.
describe('asGLBDrawFn', () => {
  it('accepts a draw fn produced by makeGLBDrawFn', () => {
    const url = '/models/creatures/test-fixture.glb';
    const fallback = () => {};
    const drawFn = makeGLBDrawFn(url, 7, 7, fallback, 0.42);

    const glb = asGLBDrawFn(drawFn);
    expect(glb).not.toBeNull();
    expect(glb?.glbUrl).toBe(url);
    expect(glb?.glbGridW).toBe(7);
    expect(glb?.glbGridH).toBe(7);
    expect(glb?.glbYaw).toBe(0.42);
  });

  it('rejects a plain function that has no glbUrl property', () => {
    const plain = (_ctx: CanvasRenderingContext2D, _w: number, _h: number) => {};
    expect(asGLBDrawFn(plain)).toBeNull();
  });

  it('rejects undefined', () => {
    expect(asGLBDrawFn(undefined)).toBeNull();
  });

  it('rejects a function where glbUrl is set but non-string', () => {
    const spoofed = Object.assign(
      (_ctx: CanvasRenderingContext2D, _w: number, _h: number) => {},
      { glbUrl: 42 as unknown as string },
    );
    expect(asGLBDrawFn(spoofed)).toBeNull();
  });

  it('preserves function identity so downstream callers see the same reference', () => {
    const drawFn = makeGLBDrawFn('/x.glb', 5, 5, () => {});
    expect(asGLBDrawFn(drawFn)).toBe(drawFn);
  });
});
