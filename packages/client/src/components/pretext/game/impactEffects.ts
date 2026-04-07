/**
 * Impact visual effects for the BattleSceneCanvas.
 * Ported from tools/creature-lab/battle-scene.js.
 *
 * Manages:
 *   - Radial burst + spark lines on hit
 *   - Monster recoil offset (translates right on impact, eases back)
 *   - White flash overlay on the monster area
 *   - Screen shake (random offset per frame)
 */

// ── Easing ──────────────────────────────────────────────────────────────

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

// ── Impact burst drawing ────────────────────────────────────────────────

/**
 * Draw a radial impact burst with spark lines.
 * @param progress 0→1 over the impact duration
 */
export function drawImpact(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
): void {
  if (progress > 1) return;

  const alpha = 1 - progress;
  const radius = w * 0.04 * (0.5 + progress * 1.5);

  ctx.save();
  ctx.globalAlpha = alpha * 0.7;

  // Radial burst gradient
  const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grd.addColorStop(0, 'rgb(255,230,180)');
  grd.addColorStop(0.4, 'rgb(255,160,60)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Spark lines
  ctx.strokeStyle = `rgba(255,200,100,${alpha * 0.8})`;
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + progress * 0.5;
    const len = radius * (0.8 + progress * 0.6);
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(angle) * radius * 0.3,
      y + Math.sin(angle) * radius * 0.3,
    );
    ctx.lineTo(
      x + Math.cos(angle) * len,
      y + Math.sin(angle) * len,
    );
    ctx.stroke();
  }

  ctx.restore();
}

// ── Hit reaction state ──────────────────────────────────────────────────

export type HitReaction = {
  /** Monster recoil X offset (px, positive = pushed right) */
  offsetX: number;
  /** White flash intensity 0-1 */
  flash: number;
  /** Screen shake magnitude 0-1 */
  shake: number;
};

export const HIT_REACTION_IDLE: HitReaction = { offsetX: 0, flash: 0, shake: 0 };

/** Duration of the recoil recovery animation (ms) */
const RECOIL_DURATION = 500;

/**
 * Compute hit reaction state from elapsed time since impact.
 * Returns IDLE when recovery is complete.
 *
 * @param elapsed ms since impact moment
 * @param w viewport width (for proportional recoil distance)
 */
export function computeHitReaction(elapsed: number, w: number): HitReaction {
  if (elapsed >= RECOIL_DURATION) return HIT_REACTION_IDLE;

  const p = elapsed / RECOIL_DURATION;
  return {
    offsetX: w * 0.03 * (1 - easeOutCubic(p)),
    flash: Math.max(0, 1 - p * 3),
    shake: (1 - p) * 0.5,
  };
}

// ── Animation queue types ───────────────────────────────────────────────

export type BattleAnim =
  | { type: 'attack'; startTime: number; duration: number; weaponType: string; impacted: boolean }
  | { type: 'impact'; startTime: number; duration: number; x: number; y: number }
  | { type: 'recoil'; startTime: number }
  | { type: 'counterRecoil'; startTime: number };

/** Impact effect duration (ms) */
export const IMPACT_DURATION = 400;
