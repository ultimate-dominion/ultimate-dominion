/**
 * fullscreenFx.ts — Effect registry and controller for FullscreenFxLayer.
 *
 * Kaplan's 5 allowed triggers for full-screen effects:
 *   1. boss_entry       — creature enters, screen-fill presence reveal
 *   2. enrage           — boss hits enrage threshold, red screen distortion
 *   3. signature_attack — creature's unique ability sweeps across screen
 *   4. death            — boss defeated, ASCII dissolve outward
 *   5. world_event      — zone-wide event (boss killed, zone cleared, etc.)
 *
 * Duration rule: 800ms–1200ms max. No skippable delays.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type FxTrigger =
  | 'boss_entry'
  | 'enrage'
  | 'signature_attack'
  | 'death'
  | 'world_event';

export type FxPayload = {
  /** Monster or boss name, used in boss_entry and death effects */
  monsterName?: string;
  /** Creature slug for creature-specific signature attacks (e.g. 'basilisk', 'dragon') */
  creature?: string;
  /** Message text for world_event */
  message?: string;
  /** Dominant color [r, g, b] for tinting (default: amber) */
  color?: [number, number, number];
};

export type ActiveFx = {
  trigger: FxTrigger;
  payload: FxPayload;
  startTime: number;
  duration: number;
};

// ── Effect registry ───────────────────────────────────────────────────────

export type EffectDef = {
  duration: number;
  draw: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,        // 0-1 normalized time
    payload: FxPayload,
  ) => void;
};

// Character palettes per effect theme
const SPARSE_CHARS = '·.`\',:;~+';
const DENSE_CHARS  = '*=#@MWNB▓█';
const FIRE_CHARS   = '^*~+≈#@!░▒';
const SLASH_CHARS  = '/\\vVᛁlI|';
const WEB_CHARS    = '+×-|·*╋';
const GAZE_CHARS   = '·∙○◎◉●';
const SCATTER_CHARS = '.,;:!+*#@%';

function easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }
function easeIn(t: number): number  { return t * t; }

/**
 * Draw an ASCII grid by sampling a brightness field function.
 * bField(col, row, cols, rows) → 0-1 brightness.
 */
function drawAsciiField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cellSize: number,
  chars: string,
  bField: (col: number, row: number, cols: number, rows: number) => number,
  colorFn: (b: number) => string,
) {
  const cols = Math.floor(w / cellSize);
  const rows = Math.floor(h / cellSize);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(cellSize * 1.1)}px 'SF Mono', 'Fira Code', monospace`;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const b = bField(col, row, cols, rows);
      if (b < 0.04) continue;

      const idx = Math.min(chars.length - 1, Math.floor(b * chars.length));
      const char = chars[idx];
      if (char === ' ') continue;

      ctx.fillStyle = colorFn(b);
      ctx.fillText(char, col * cellSize + cellSize / 2, row * cellSize + cellSize / 2);
    }
  }
}

export const EFFECT_REGISTRY: Record<FxTrigger, EffectDef> = {

  // ── 1. Boss Entry (1000ms) ──────────────────────────────────────────────
  // ASCII chars radiate outward from center as creature presence fills screen.
  // Amber-gold palette, dense at center, sparse at edges.
  boss_entry: {
    duration: 1000,
    draw(ctx, w, h, t, payload) {
      const [r, g, b] = payload.color ?? [210, 160, 40];
      const radius = easeOut(t);                     // how far chars have spread
      const fadeOut = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1; // fade tail
      const alpha = fadeOut;
      if (alpha <= 0) return;

      // Background dim
      ctx.fillStyle = `rgba(0,0,0,${0.65 * Math.min(1, t * 3) * fadeOut})`;
      ctx.fillRect(0, 0, w, h);

      const cellSize = Math.max(8, Math.min(14, w / 60));

      drawAsciiField(ctx, w, h, cellSize, DENSE_CHARS + SPARSE_CHARS,
        (col, row, cols, rows) => {
          const nx = col / cols - 0.5;
          const ny = row / rows - 0.5;
          const dist = Math.sqrt(nx * nx + ny * ny) / 0.7; // 0-1 normalized from center
          if (dist > radius) return 0;
          const fieldB = (1 - dist / Math.max(0.01, radius)) * easeOut(t);
          return Math.min(1, fieldB * (0.3 + Math.random() * 0.15));
        },
        (bv) => {
          const intensity = bv;
          return `rgba(${Math.floor(r * intensity)}, ${Math.floor(g * intensity * 0.75)}, ${Math.floor(b * intensity * 0.2)}, ${alpha * (0.4 + intensity * 0.6)})`;
        },
      );

      // Boss name
      const name = payload.monsterName ?? '';
      if (name && t > 0.2) {
        const nameAlpha = Math.min(1, (t - 0.2) / 0.3) * fadeOut;
        ctx.save();
        ctx.globalAlpha = nameAlpha;
        ctx.fillStyle = `rgb(${r}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.3)})`;
        const fs = Math.max(24, Math.min(w / (name.length * 0.7), h * 0.18));
        ctx.font = `700 ${fs}px 'Cormorant Garamond', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.toUpperCase(), w / 2, h * 0.5);
        ctx.restore();
      }
    },
  },

  // ── 2. Enrage (800ms) ──────────────────────────────────────────────────
  // Red screen wave sweeping right-to-left. ASCII chars become harsh, angular.
  enrage: {
    duration: 800,
    draw(ctx, w, h, t) {
      // Two pulses: bright flash then settle
      const pulse = t < 0.15 ? t / 0.15 :
                    t < 0.40 ? 1 - (t - 0.15) / 0.25 :
                    t < 0.55 ? (t - 0.40) / 0.15 :
                    t < 0.80 ? 1 - (t - 0.55) / 0.25 :
                               1 - (t - 0.80) / 0.20;

      const alpha = Math.max(0, pulse * 0.75);
      if (alpha <= 0) return;

      ctx.fillStyle = `rgba(180, 10, 5, ${alpha * 0.45})`;
      ctx.fillRect(0, 0, w, h);

      // Sweep progress — wave of dense chars moves left across screen
      const sweepX = (1 - easeIn(t)) * w;

      const cellSize = Math.max(8, Math.min(12, w / 65));
      drawAsciiField(ctx, w, h, cellSize, SLASH_CHARS + '!×#',
        (col, row, cols, rows) => {
          const x = col / cols * w;
          if (x < sweepX - cellSize * 4) return 0;
          const distFromFront = (x - sweepX) / (w * 0.25);
          const waveFalloff = Math.max(0, 1 - Math.abs(distFromFront));
          const noise = Math.random() * 0.3;
          return waveFalloff * 0.85 + noise;
        },
        (bv) => `rgba(220, ${Math.floor(20 * bv)}, ${Math.floor(5 * bv)}, ${alpha * (0.3 + bv * 0.7)})`,
      );
    },
  },

  // ── 3. Signature Attack (900ms) ─────────────────────────────────────────
  // Creature-specific visual. Defaults to horizontal slash sweep.
  signature_attack: {
    duration: 900,
    draw(ctx, w, h, t, payload) {
      const creature = payload.creature ?? '';
      const [cr, cg, cb] = payload.color ?? [220, 160, 60];
      const fadeOut = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      if (fadeOut <= 0) return;

      if (creature === 'basilisk' || creature === 'serpent') {
        // Gaze / petrification: concentric rings of circle-dot chars expand from head side
        const ringT = easeOut(t);
        const cellSize = Math.max(7, Math.min(11, w / 70));
        ctx.fillStyle = `rgba(0,0,0,${0.4 * fadeOut})`;
        ctx.fillRect(0, 0, w, h);
        drawAsciiField(ctx, w, h, cellSize, GAZE_CHARS,
          (col, row, cols, rows) => {
            const nx = col / cols;               // 0=left (head side)
            const ny = row / rows - 0.5;
            const dist = Math.sqrt(nx * nx + ny * ny) * 1.4;
            const ring = Math.abs((dist / ringT) % 1 - 0.5) * 2; // ring pattern
            return ring > 0.6 ? (1 - nx * 0.4) * 0.9 : 0;
          },
          (bv) => `rgba(${Math.floor(240 * bv)}, ${Math.floor(200 * bv)}, ${Math.floor(40 * bv)}, ${fadeOut * (0.3 + bv * 0.7)})`,
        );

      } else if (creature === 'dragon' || creature === 'fire') {
        // Fire breath: columns fill from top, hot colors
        const fireT = easeOut(t);
        const cellSize = Math.max(7, Math.min(12, w / 65));
        ctx.fillStyle = `rgba(0,0,0,${0.5 * fadeOut})`;
        ctx.fillRect(0, 0, w, h);
        drawAsciiField(ctx, w, h, cellSize, FIRE_CHARS,
          (col, row, cols, rows) => {
            // Columns fill from top in a wave from left
            const waveX = col / cols;
            const delay = waveX * 0.4;            // left columns lead
            const colT = Math.max(0, (fireT - delay) / (1 - delay));
            const fillY = colT * rows;
            if (row > fillY) return 0;
            const distFromTip = (fillY - row) / rows;
            return Math.max(0, 1 - distFromTip * 1.8) * (0.7 + Math.random() * 0.3);
          },
          (bv) => {
            const rr = Math.floor(255 * bv);
            const gg = Math.floor(120 * bv * bv);
            return `rgba(${rr}, ${gg}, 0, ${fadeOut * (0.4 + bv * 0.6)})`;
          },
        );

      } else {
        // Default: diagonal slash sweep from top-right toward bottom-left
        const sweepT = easeOut(t);
        const cellSize = Math.max(7, Math.min(12, w / 65));
        ctx.fillStyle = `rgba(0,0,0,${0.4 * fadeOut})`;
        ctx.fillRect(0, 0, w, h);
        drawAsciiField(ctx, w, h, cellSize, SLASH_CHARS,
          (col, row, cols, rows) => {
            // Diagonal: line from (1,0) sweeping to (0,1)
            const diag = (1 - col / cols) + row / rows;  // 0 top-right, 2 bottom-left
            const front = sweepT * 2;
            const dist = Math.abs(diag - front);
            return dist < 0.3 ? (1 - dist / 0.3) * 0.9 : 0;
          },
          (bv) => `rgba(${cr}, ${cg}, ${Math.floor(cb * 0.5)}, ${fadeOut * (0.4 + bv * 0.6)})`,
        );
      }
    },
  },

  // ── 4. Death (1200ms) ──────────────────────────────────────────────────
  // ASCII chars scatter outward from center, fading and dimming.
  death: {
    duration: 1200,
    draw(ctx, w, h, t, payload) {
      const [cr, cg, cb] = payload.color ?? [100, 180, 80];
      const scatter = easeOut(t);
      const globalFade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      if (globalFade <= 0) return;

      ctx.fillStyle = `rgba(0,0,0,${0.55 * Math.min(1, t * 4) * globalFade})`;
      ctx.fillRect(0, 0, w, h);

      const cellSize = Math.max(8, Math.min(13, w / 60));
      drawAsciiField(ctx, w, h, cellSize, SCATTER_CHARS,
        (col, row, cols, rows) => {
          const nx = col / cols - 0.5;
          const ny = row / rows - 0.5;
          const dist = Math.sqrt(nx * nx + ny * ny) / 0.7;
          // Chars scatter outward: inner ring has passed, outer ring is arriving
          const ring = Math.abs(dist - scatter * 1.2);
          return ring < 0.15 ? (1 - ring / 0.15) * 0.85 : 0;
        },
        (bv) => `rgba(${Math.floor(cr * bv)}, ${Math.floor(cg * bv)}, ${Math.floor(cb * bv)}, ${globalFade * (0.3 + bv * 0.7)})`,
      );

      // DEFEATED text
      if (t > 0.25 && t < 0.8) {
        const txtAlpha = t < 0.35 ? (t - 0.25) / 0.1 : t > 0.65 ? 1 - (t - 0.65) / 0.15 : 1;
        ctx.save();
        ctx.globalAlpha = txtAlpha * globalFade * 0.9;
        ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
        const fs = Math.max(18, Math.min(w * 0.07, h * 0.12));
        ctx.font = `600 ${fs}px 'Cormorant Garamond', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const name = payload.monsterName ?? 'Enemy';
        ctx.fillText(`${name.toUpperCase()} DEFEATED`, w / 2, h * 0.5);
        ctx.restore();
      }
    },
  },

  // ── 5. World Event (1000ms) ─────────────────────────────────────────────
  // Zone-wide message types from left to right in ASCII chars.
  world_event: {
    duration: 1000,
    draw(ctx, w, h, t, payload) {
      const msg = payload.message ?? 'A great event unfolds...';
      const [cr, cg, cb] = payload.color ?? [100, 140, 220];
      const fadeIn  = Math.min(1, t / 0.25);
      const fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const alpha = fadeIn * fadeOut;
      if (alpha <= 0) return;

      ctx.fillStyle = `rgba(0,0,0,${0.60 * alpha})`;
      ctx.fillRect(0, 0, w, h);

      // Subtle ASCII particle field
      const cellSize = Math.max(9, Math.min(14, w / 55));
      drawAsciiField(ctx, w, h, cellSize, SPARSE_CHARS,
        (col, row, cols, rows) => {
          const ny = Math.abs(row / rows - 0.5) * 2;  // 0 center, 1 edges
          return Math.max(0, 0.25 - ny * 0.25) * t * 0.8;
        },
        (bv) => `rgba(${cr}, ${cg}, ${cb}, ${alpha * bv * 0.5})`,
      );

      // Message text — reveals left to right
      const revealFrac = easeOut(Math.min(1, t / 0.6));
      const visibleChars = Math.floor(msg.length * revealFrac);
      const visText = msg.slice(0, visibleChars);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
      const fs = Math.max(14, Math.min(w * 0.05, h * 0.08));
      ctx.font = `600 ${fs}px 'Cormorant Garamond', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(visText, w / 2, h * 0.48);

      // Sub-label
      if (t > 0.4) {
        ctx.globalAlpha = alpha * Math.min(1, (t - 0.4) / 0.2) * 0.55;
        ctx.font = `400 ${Math.max(10, fs * 0.5)}px 'SF Mono', monospace`;
        ctx.fillText('— ZONE EVENT —', w / 2, h * 0.48 + fs * 1.6);
      }
      ctx.restore();
    },
  },
};

// ── Controller ────────────────────────────────────────────────────────────

/**
 * FullscreenFxController — manages a queue of full-screen effects.
 * Designed to be used imperatively from a React ref.
 *
 * Effects play one at a time — a new trigger while one is playing either
 * replaces it (for boss_entry/death) or queues (for shorter effects).
 */
export class FullscreenFxController {
  private _active: ActiveFx | null = null;
  private _queue: Array<{ trigger: FxTrigger; payload: FxPayload }> = [];

  get active(): ActiveFx | null { return this._active; }

  trigger(trigger: FxTrigger, payload: FxPayload = {}) {
    const def = EFFECT_REGISTRY[trigger];
    if (!def) return;

    // boss_entry and death always interrupt — they're the highest priority
    if (trigger === 'boss_entry' || trigger === 'death') {
      this._active = { trigger, payload, startTime: performance.now(), duration: def.duration };
      this._queue = [];
      return;
    }

    // If nothing active, play immediately
    if (!this._active) {
      this._active = { trigger, payload, startTime: performance.now(), duration: def.duration };
      return;
    }

    // Otherwise queue (max 2 queued, drop oldest)
    if (this._queue.length >= 2) this._queue.shift();
    this._queue.push({ trigger, payload });
  }

  /** Advance state — call from RAF loop. Returns true if any effect is active. */
  tick(): boolean {
    if (!this._active) {
      if (this._queue.length > 0) {
        const next = this._queue.shift()!;
        const def = EFFECT_REGISTRY[next.trigger];
        this._active = { ...next, startTime: performance.now(), duration: def.duration };
      }
      return !!this._active;
    }

    const elapsed = performance.now() - this._active.startTime;
    if (elapsed >= this._active.duration) {
      this._active = null;
      return this.tick(); // try next in queue
    }
    return true;
  }

  /** Draw the current active effect. Call after tick(). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this._active) return;
    const elapsed = performance.now() - this._active.startTime;
    const t = Math.min(1, elapsed / this._active.duration);
    const def = EFFECT_REGISTRY[this._active.trigger];
    def.draw(ctx, w, h, t, this._active.payload);
  }
}
