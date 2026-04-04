/**
 * BattleSceneCanvas — Cinematic single-canvas battle view.
 *
 * Composites:
 *   - ASCII monster (right 60%) via MonsterAsciiRenderer
 *   - Weapon projectile flight (left → right)
 *   - Impact burst + spark lines on hit
 *   - Monster recoil / white flash / screen shake
 *   - HP bars (monster top, player bottom-left)
 *   - Left vignette (player presence)
 *   - Defeated overlay
 *
 * Ported from tools/creature-lab/battle-scene.js into React + useCanvas.
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { renderMonster, type AnimationState } from './MonsterAsciiRenderer';
import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';
import { loadGLBCreature } from './glbCreatureLoader';

// Kick off GLB loading immediately when the battle scene module loads —
// don't wait for the first encounter frame, which may be too late on slow connections.
loadGLBCreature('/models/creatures/dire-rat.glb', 10, 7).catch(() => {/* handled inside */});
import type { MonsterTemplate } from './monsterTemplates';
import { COLORS, FONTS, fontString } from '../theme';
import { usePretextFonts } from '../hooks/usePretextFonts';
import {
  drawWeapon,
  WEAPON_SPEED,
  type WeaponAnimType,
} from './weaponAnimations';
import {
  drawImpact,
  easeInQuad,
  computeHitReaction,
  HIT_REACTION_IDLE,
  IMPACT_DURATION,
  type HitReaction,
} from './impactEffects';
import type { AttackSignal, BattleSceneHandle } from '../../../hooks/useBattleSceneSignals';

// ── Types ───────────────────────────────────────────────────────────────

export type BattleSceneProps = {
  monsterName: string;
  monsterHp: number;
  monsterMaxHp: number;
  monsterDefeated: boolean;
  monsterLevel: number;
  userHp: number;
  userMaxHp: number;
  userName: string;
  userDefeated: boolean;
};

// ── Internal animation state (mutated in RAF, no React state) ───────────

type ActiveAttack = {
  weaponType: WeaponAnimType;
  startTime: number;
  duration: number;
  damage: number;
  isCrit: boolean;
  isPlayerAttack: boolean;
  impacted: boolean;
};

type ActiveImpact = {
  startTime: number;
  x: number;
  y: number;
};

type SceneState = {
  attacks: ActiveAttack[];
  impacts: ActiveImpact[];
  hitReaction: HitReaction;
  hitReactionStart: number;
  /** Monster animation state for the renderer */
  monsterAnim: AnimationState | undefined;
};

function createSceneState(): SceneState {
  return {
    attacks: [],
    impacts: [],
    hitReaction: HIT_REACTION_IDLE,
    hitReactionStart: -1,
    monsterAnim: undefined,
  };
}

// ── HP bar rendering ────────────────────────────────────────────────────

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  barW: number,
  barH: number,
  current: number,
  max: number,
  label: string,
  isMonster: boolean,
) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, barW, barH, 3);
  ctx.fill();

  // Border
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, barW, barH, 3);
  ctx.stroke();

  // Fill — green above 50%, amber 25-50%, red below 25%
  let fillColor: string;
  if (pct > 0.5) fillColor = COLORS.success;
  else if (pct > 0.25) fillColor = COLORS.amber;
  else fillColor = COLORS.danger;

  if (pct > 0) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, (barW - 2) * pct, barH - 2, 2);
    ctx.fill();
  }

  // Label text
  const fontSize = Math.max(10, barH * 0.7);
  ctx.font = fontString('ui', fontSize, 500);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.textAlign = isMonster ? 'left' : 'right';
  ctx.textBaseline = 'middle';

  const labelX = isMonster ? x + 6 : x + barW - 6;
  ctx.fillText(label, labelX, y + barH / 2);

  // HP text
  ctx.textAlign = isMonster ? 'right' : 'left';
  const hpX = isMonster ? x + barW - 6 : x + 6;
  ctx.font = fontString('mono', fontSize - 1, 400);
  ctx.fillStyle = COLORS.textBody;
  ctx.fillText(`${current}/${max}`, hpX, y + barH / 2);
}

// ── Monster name with threat weight ─────────────────────────────────────

function drawMonsterName(
  ctx: CanvasRenderingContext2D,
  name: string,
  level: number,
  x: number,
  y: number,
  defeated: boolean,
) {
  const threat = Math.max(1, Math.min(10, level));
  let weight: number;
  if (threat <= 2) weight = 300;
  else if (threat <= 4) weight = 400;
  else if (threat <= 6) weight = 500;
  else if (threat <= 8) weight = 600;
  else weight = 700;

  let color: string;
  if (defeated) color = COLORS.textMuted;
  else if (threat <= 2) color = COLORS.textMuted;
  else if (threat <= 4) color = COLORS.textBody;
  else if (threat <= 6) color = COLORS.textPrimary;
  else if (threat <= 8) color = COLORS.amber;
  else color = COLORS.danger;

  ctx.font = fontString('heading', 16, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Glow for high threat
  if (!defeated && threat > 6) {
    ctx.save();
    ctx.shadowColor = threat > 8 ? COLORS.danger : COLORS.amber;
    ctx.shadowBlur = threat > 8 ? 20 : 8;
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  ctx.fillText(name, x, y);
}

// ── Component ───────────────────────────────────────────────────────────

export const BattleSceneCanvas = forwardRef<BattleSceneHandle, BattleSceneProps>(
  function BattleSceneCanvas(props, ref) {
    const {
      monsterName,
      monsterHp,
      monsterMaxHp,
      monsterDefeated,
      monsterLevel,
      userHp,
      userMaxHp,
      userName,
      userDefeated,
    } = props;

    const { ready } = usePretextFonts();
    const stateRef = useRef<SceneState>(createSceneState());

    // Freeze props into refs for RAF access without re-renders
    const propsRef = useRef(props);
    propsRef.current = props;

    const template: MonsterTemplate | undefined = useMemo(
      () => MONSTER_TEMPLATES_REDUX.find((t) => t.name === monsterName),
      [monsterName],
    );

    // ── Imperative API ──────────────────────────────────────────────────

    const triggerAttack = useCallback((signal: AttackSignal) => {
      const state = stateRef.current;
      const duration = WEAPON_SPEED[signal.weaponType];

      state.attacks.push({
        weaponType: signal.weaponType,
        startTime: performance.now(),
        duration,
        damage: signal.damage,
        isCrit: signal.isCrit,
        isPlayerAttack: signal.isPlayerAttack,
        impacted: false,
      });
    }, []);

    useImperativeHandle(ref, () => ({ triggerAttack }), [triggerAttack]);

    // ── Render loop ─────────────────────────────────────────────────────

    const onFrame = useCallback(
      (ctx: CanvasRenderingContext2D, dt: number, elapsed: number) => {
        const { width: w, height: h } = ctx.canvas.getBoundingClientRect();
        if (w === 0 || h === 0) return;

        const p = propsRef.current;
        const state = stateRef.current;
        const now = performance.now();

        ctx.clearRect(0, 0, w, h);

        // ── Process attack animations ───────────────────────────────────

        let activeProjectile: {
          weaponType: WeaponAnimType;
          progress: number;
          isPlayerAttack: boolean;
        } | null = null;

        for (let i = state.attacks.length - 1; i >= 0; i--) {
          const atk = state.attacks[i];
          const atkElapsed = now - atk.startTime;
          const progress = atkElapsed / atk.duration;

          if (progress < 1) {
            // Projectile in flight
            if (!activeProjectile) {
              activeProjectile = {
                weaponType: atk.weaponType,
                progress,
                isPlayerAttack: atk.isPlayerAttack,
              };
            }
          } else if (!atk.impacted) {
            // Impact moment
            atk.impacted = true;

            // Trigger monster hit animation
            if (atk.isPlayerAttack) {
              state.hitReactionStart = now;
              state.monsterAnim = { action: 'hit', startTime: now };

              // Spawn impact effect
              state.impacts.push({
                startTime: now,
                x: w * 0.55,
                y: h * 0.45,
              });
            }
          }

          // Clean up finished attacks (allow 200ms after impact for overlap)
          if (atkElapsed > atk.duration + 200) {
            state.attacks.splice(i, 1);
          }
        }

        // ── Compute hit reaction ────────────────────────────────────────

        if (state.hitReactionStart > 0) {
          const recoilElapsed = now - state.hitReactionStart;
          state.hitReaction = computeHitReaction(recoilElapsed, w);
          if (recoilElapsed > 500) {
            state.hitReactionStart = -1;
            state.hitReaction = HIT_REACTION_IDLE;
            state.monsterAnim = undefined;
          }
        }

        // ── Clean old impacts ───────────────────────────────────────────

        for (let i = state.impacts.length - 1; i >= 0; i--) {
          if (now - state.impacts[i].startTime > IMPACT_DURATION) {
            state.impacts.splice(i, 1);
          }
        }

        // ── Render monster (right 60%) ──────────────────────────────────

        const { offsetX, flash, shake } = state.hitReaction;
        const shakeX = shake * (Math.random() - 0.5) * w * 0.01;
        const shakeY = shake * (Math.random() - 0.5) * h * 0.01;

        ctx.save();
        ctx.translate(offsetX + shakeX, shakeY);

        const monsterX = w * 0.30;
        const monsterW = w * 0.70;
        const monsterY = 0;
        const monsterH = h;

        if (template) {
          renderMonster(ctx, template, monsterX, monsterY, monsterW, monsterH, {
            elapsed: p.monsterDefeated ? 0 : elapsed,
            cellSize: 5,
            enable3D: false,
            enableGlow: !p.monsterDefeated,
            enableBgFill: true,
            animation: state.monsterAnim,
          });
        }

        // White flash overlay on hit
        if (flash > 0) {
          ctx.save();
          ctx.globalAlpha = flash * 0.3;
          ctx.fillStyle = '#fff';
          ctx.fillRect(monsterX, monsterY, monsterW, monsterH);
          ctx.restore();
        }

        // Defeated overlay
        if (p.monsterDefeated) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#000';
          ctx.fillRect(monsterX, monsterY, monsterW, monsterH);
          ctx.restore();
        }

        ctx.restore();

        // ── Render weapon projectile ────────────────────────────────────

        if (activeProjectile) {
          const { weaponType, progress, isPlayerAttack } = activeProjectile;
          const t = easeInQuad(progress);

          let startX: number, endX: number, startY: number, endY: number;
          if (isPlayerAttack) {
            // Player attack: fly left → right toward monster
            startX = w * 0.05;
            endX = w * 0.55;
            startY = h * 0.45;
            endY = h * 0.50;
          } else {
            // Counterattack: fly right → left toward player
            startX = w * 0.60;
            endX = w * 0.15;
            startY = h * 0.45;
            endY = h * 0.50;
          }

          const projX = startX + (endX - startX) * t;
          const projY = startY + (endY - startY) * t;
          drawWeapon(ctx, weaponType, projX, projY, w, h, progress);
        }

        // ── Render impact effects ───────────────────────────────────────

        for (const impact of state.impacts) {
          const impProgress = (now - impact.startTime) / IMPACT_DURATION;
          drawImpact(
            ctx,
            impact.x + state.hitReaction.offsetX,
            impact.y,
            w,
            impProgress,
          );
        }

        // ── Left vignette (player presence) ─────────────────────────────

        const vigGrd = ctx.createLinearGradient(0, 0, w * 0.3, 0);
        vigGrd.addColorStop(0, 'rgba(10,10,8,0.7)');
        vigGrd.addColorStop(1, 'rgba(10,10,8,0)');
        ctx.fillStyle = vigGrd;
        ctx.fillRect(0, 0, w * 0.3, h);

        // ── HUD: Monster name + HP bar (top-right area) ────────────────

        const hudPad = 12;
        const barW = Math.min(200, w * 0.35);
        const barH = 18;

        drawMonsterName(
          ctx,
          p.monsterName,
          p.monsterLevel,
          monsterX + hudPad,
          hudPad,
          p.monsterDefeated,
        );

        drawHpBar(
          ctx,
          monsterX + hudPad,
          hudPad + 22,
          barW,
          barH,
          p.monsterHp,
          p.monsterMaxHp,
          p.monsterDefeated ? 'Defeated' : `Lv.${p.monsterLevel}`,
          true,
        );

        // ── HUD: Player HP bar (bottom-left) ───────────────────────────

        const playerBarW = Math.min(180, w * 0.30);

        drawHpBar(
          ctx,
          hudPad,
          h - hudPad - barH,
          playerBarW,
          barH,
          p.userHp,
          p.userMaxHp,
          p.userName,
          false,
        );
      },
      [template],
    );

    const { canvasRef } = useCanvas({
      onFrame,
      static: monsterDefeated && stateRef.current.attacks.length === 0,
    });

    if (!ready || !template) return null;

    return (
      <Box
        position="relative"
        w="100%"
        h="100%"
        bg={COLORS.bg}
        overflow="hidden"
        borderRadius="md"
        aria-label="Battle scene"
      >
        <canvas
          ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
    );
  },
);
