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

import { Box } from '@chakra-ui/react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import type {
  AttackSignal,
  BattleSceneHandle,
} from '../../../hooks/useBattleSceneSignals';
import { Race } from '../../../utils/types';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS, fontString } from '../theme';

import { getCaveBg, renderCaveBgFlicker } from './caveBgRenderer';
import {
  getCreatureState,
  loadGLBCreature,
  makeGLBDrawFn,
} from './glbCreatureLoader';
import {
  computeHitReaction,
  drawImpact,
  easeInQuad,
  HIT_REACTION_IDLE,
  IMPACT_DURATION,
  REACTION_DURATION,
  type HitReaction,
} from './impactEffects';
import { renderMonster, type AnimationState } from './MonsterAsciiRenderer';
import type { MonsterTemplate } from './monsterTemplates';
import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';
import {
  drawWeapon,
  WEAPON_SPEED,
  type WeaponAnimType,
} from './weaponAnimations';

// Kick off GLB loading immediately when the battle scene module loads —
// don't wait for the first encounter frame, which may be too late on slow connections.
loadGLBCreature('/models/creatures/dire-rat.glb', 10, 7).catch(() => {
  /* handled inside */
});
loadGLBCreature('/models/creatures/kobold.glb', 7, 7).catch(() => {
  /* handled inside */
});
loadGLBCreature('/models/creatures/goblin.glb', 7, 7).catch(() => {
  /* handled inside */
});
loadGLBCreature('/models/creatures/skeleton.glb', 7, 7).catch(() => {
  /* handled inside */
});
loadGLBCreature('/models/creatures/goblin-shaman.glb', 7, 7).catch(() => {
  /* handled inside */
});
loadGLBCreature('/models/creatures/bugbear.glb', 7, 7).catch(() => {
  /* handled inside */
});

// Preload player character GLBs — mirrored (face right) via positive yaw, player mode
const PLAYER_YAW = Math.PI * 0.33; // face right (opposite of monster yaw)
loadGLBCreature(
  '/models/creatures/human-animated.glb',
  7,
  7,
  PLAYER_YAW,
  -0.08,
  { playerMode: true },
).catch(() => {});
loadGLBCreature('/models/creatures/elf-animated.glb', 7, 7, PLAYER_YAW, -0.08, {
  playerMode: true,
}).catch(() => {});
loadGLBCreature(
  '/models/creatures/dwarf-animated.glb',
  7,
  7,
  PLAYER_YAW,
  -0.08,
  { playerMode: true },
).catch(() => {});

// Map Race enum → GLB URL
const RACE_GLB_URL: Record<number, string> = {
  [Race.Human]: '/models/creatures/human-animated.glb',
  [Race.Elf]: '/models/creatures/elf-animated.glb',
  [Race.Dwarf]: '/models/creatures/dwarf-animated.glb',
};

// Fallback draw for player (simple silhouette while GLB loads)
function drawPlayerFallback(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  ctx.fillStyle = 'rgb(60,55,48)';
  const cx = w * 0.5,
    cy = h * 0.4;
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.15, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillRect(cx - w * 0.06, cy - h * 0.05, w * 0.12, h * 0.25);
}

// Build player MonsterTemplate-compatible objects lazily
const playerTemplateCache = new Map<
  number,
  ReturnType<typeof buildPlayerTemplate>
>();
function buildPlayerTemplate(race: Race) {
  const url = RACE_GLB_URL[race];
  if (!url) return null;
  return {
    id: `player-${Race[race]?.toLowerCase() ?? 'unknown'}`,
    name: Race[race] ?? 'Adventurer',
    gridWidth: 7,
    gridHeight: 7,
    monsterClass: 0 as const,
    level: 1,
    dynamic: true,
    draw: makeGLBDrawFn(url, 7, 7, drawPlayerFallback, PLAYER_YAW),
  };
}

function getPlayerTemplate(race: Race) {
  let tpl = playerTemplateCache.get(race);
  if (!tpl) {
    tpl = buildPlayerTemplate(race);
    if (tpl) playerTemplateCache.set(race, tpl);
  }
  return tpl;
}

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
  /** Player character race — determines which GLB model to render on the left */
  userRace?: Race;
};

// ── Internal animation state (mutated in RAF, no React state) ───────────

type ActiveAttack = {
  weaponType: WeaponAnimType;
  weaponName?: string;
  startTime: number;
  duration: number;
  damage: number;
  hitCount: number;
  isCrit: boolean;
  isCombo: boolean;
  isPlayerAttack: boolean;
  blocked: boolean;
  dodged: boolean;
  didHit: boolean;
  targetDied: boolean;
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
  /** Hit reaction tier for current recoil */
  hitReactionTier: 'hit' | 'stagger' | 'critical';
  /** Monster animation state for the renderer */
  monsterAnim: AnimationState | undefined;
  /** Player hit flash timestamp (-1 = idle) */
  playerHitStart: number;
  /** Player attack anim timestamp (-1 = idle) */
  playerAttackStart: number;
};

function createSceneState(): SceneState {
  return {
    attacks: [],
    impacts: [],
    hitReaction: HIT_REACTION_IDLE,
    hitReactionStart: -1,
    hitReactionTier: 'hit',
    monsterAnim: undefined,
    playerHitStart: -1,
    playerAttackStart: -1,
  };
}

// Callout box removed — damage displayed via BattleFloatingDamage overlay only

// ── HP bar rendering ────────────────────────────────────────────────────

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
  ctx.textAlign = 'right';
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

function drawPlayerName(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  defeated: boolean,
) {
  ctx.font = fontString('heading', 14, 400);
  ctx.fillStyle = defeated ? COLORS.textMuted : COLORS.textBody;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x, y);
}

// ── Component ───────────────────────────────────────────────────────────

export const BattleSceneCanvas = forwardRef<
  BattleSceneHandle,
  BattleSceneProps
>(function BattleSceneCanvas(props, ref) {
  const { monsterName, monsterDefeated, userRace } = props;

  const { ready } = usePretextFonts();
  const stateRef = useRef<SceneState>(createSceneState());

  // Freeze props into refs for RAF access without re-renders
  const propsRef = useRef(props);
  propsRef.current = props;

  const template: MonsterTemplate | undefined = useMemo(
    () => MONSTER_TEMPLATES_REDUX.find(t => t.name === monsterName),
    [monsterName],
  );

  // Player character template (race-based GLB)
  const playerTemplate = useMemo(
    () => (userRace ? getPlayerTemplate(userRace) : null),
    [userRace],
  );

  // ── Imperative API ──────────────────────────────────────────────────

  const triggerAttack = useCallback((signal: AttackSignal) => {
    const state = stateRef.current;
    const duration = WEAPON_SPEED[signal.weaponType];
    const p = propsRef.current;

    state.attacks.push({
      weaponType: signal.weaponType,
      weaponName: signal.weaponName,
      startTime: performance.now(),
      duration,
      damage: signal.damage,
      hitCount: signal.hitCount,
      isCrit: signal.isCrit,
      isCombo: signal.isCombo,
      isPlayerAttack: signal.isPlayerAttack,
      blocked: signal.blocked,
      dodged: signal.dodged,
      didHit: signal.didHit,
      targetDied: signal.targetDied,
      impacted: false,
    });

    // Start player attack animation immediately (swing during projectile flight)
    if (signal.isPlayerAttack && p.userRace) {
      const playerUrl = RACE_GLB_URL[p.userRace];
      if (playerUrl) {
        const ps = getCreatureState(playerUrl);
        ps?.playClip?.('attack');
      }
    }
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

      // ── Cave background ─────────────────────────────────────────────

      const caveBg = getCaveBg(w, h);
      ctx.drawImage(caveBg.canvas, 0, 0);
      renderCaveBgFlicker(ctx, caveBg.cells, elapsed);

      // ── Process attack animations ───────────────────────────────────

      let activeProjectile: {
        weaponType: WeaponAnimType;
        weaponName?: string;
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
              weaponName: atk.weaponName,
              progress,
              isPlayerAttack: atk.isPlayerAttack,
            };
          }
        } else if (!atk.impacted) {
          // Impact moment
          atk.impacted = true;

          // Pick defender clip: dodge > block > hit/death
          const defenderClip = atk.dodged
            ? 'dodge'
            : atk.blocked
              ? 'block'
              : atk.targetDied
                ? 'death'
                : 'hit';

          if (atk.isPlayerAttack) {
            state.playerAttackStart = now;

            // Spawn impact effect (skip on dodge — no contact)
            if (atk.didHit && !atk.dodged) {
              state.impacts.push({
                startTime: now,
                x: w * 0.55,
                y: h * 0.45,
              });
            }

              if (atk.targetDied) {
                state.monsterAnim = { action: 'death', startTime: now };
                state.hitReactionStart = -1;
                state.hitReaction = HIT_REACTION_IDLE;
              } else {
                state.hitReactionStart = now;
                // Tier: critical > stagger (combo) > hit
                state.hitReactionTier = atk.isCrit
                  ? 'critical'
                  : atk.hitCount > 1
                    ? 'stagger'
                    : 'hit';
                state.monsterAnim = { action: defenderClip, startTime: now };
              }

              // Spawn extra impact sparks for combos/crits
              if (atk.didHit && !atk.dodged && (atk.hitCount > 1 || atk.isCrit)) {
                const sparkCount = Math.min(atk.hitCount, 5);
                for (let s = 0; s < sparkCount; s++) {
                  state.impacts.push({
                    startTime: now + s * 40,
                    x: w * 0.55 + (Math.random() - 0.5) * w * 0.06,
                    y: h * 0.45 + (Math.random() - 0.5) * h * 0.08,
                  });
                }
              }
          } else {
            // Counterattack hits player
            if (atk.didHit) {
              state.playerHitStart = now;
            }

            // Trigger defender animation on player GLB
            const playerUrl = p.userRace ? RACE_GLB_URL[p.userRace] : null;
            if (playerUrl) {
              const ps = getCreatureState(playerUrl);
              ps?.playClip?.(atk.targetDied ? 'death' : defenderClip);
            }
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
        state.hitReaction = computeHitReaction(recoilElapsed, w, state.hitReactionTier);
        const tierDuration = REACTION_DURATION[state.hitReactionTier];
        if (recoilElapsed > tierDuration) {
          state.hitReactionStart = -1;
          state.hitReaction = HIT_REACTION_IDLE;
          if (state.monsterAnim?.action === 'hit') {
            state.monsterAnim = undefined;
          }
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

      const monsterX = w * 0.3;
      const monsterW = w * 0.7;
      const monsterY = 0;
      const monsterH = h;

      if (template) {
        renderMonster(ctx, template, monsterX, monsterY, monsterW, monsterH, {
          elapsed: p.monsterDefeated ? 0 : elapsed,
          cellSize: 4,
          enable3D: true,
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
        const { weaponType, weaponName, progress, isPlayerAttack } = activeProjectile;
        const t = easeInQuad(progress);

        let startX: number, endX: number, startY: number, endY: number;
        if (isPlayerAttack) {
          startX = w * 0.05;
          endX = w * 0.55;
          startY = h * 0.45;
          endY = h * 0.5;
        } else {
          startX = w * 0.6;
          endX = w * 0.15;
          startY = h * 0.45;
          endY = h * 0.5;
        }

        const projX = startX + (endX - startX) * t;
        const projY = startY + (endY - startY) * t;
        drawWeapon(ctx, weaponType, projX, projY, w, h, progress, weaponName, !isPlayerAttack);
      }

      // ── Render impact effects ───────────────────────────────────────
      // TODO: replace drawImpact with ASCII-style impact effect
      // Impact state is still tracked (state.impacts) for future use.


      // ── Render player character (left 35%) ──────────────────────────

      const playerTpl = playerTemplate;
      if (playerTpl) {
        const playerX = 0;
        const playerW = w * 0.35;
        const playerY = 0;
        const playerH = h;

        // Player hit flash
        let playerFlash = 0;
        if (state.playerHitStart > 0) {
          const hitElapsed = now - state.playerHitStart;
          if (hitElapsed < 400) {
            playerFlash = Math.max(0, 1 - hitElapsed / 400);
          } else {
            state.playerHitStart = -1;
          }
        }

        // Reset player attack timestamp
        if (
          state.playerAttackStart > 0 &&
          now - state.playerAttackStart > 800
        ) {
          state.playerAttackStart = -1;
        }

        ctx.save();

        // Subtle shake when player is hit
        if (playerFlash > 0) {
          const pShakeX = playerFlash * (Math.random() - 0.5) * w * 0.008;
          const pShakeY = playerFlash * (Math.random() - 0.5) * h * 0.008;
          ctx.translate(pShakeX, pShakeY);
        }

        renderMonster(ctx, playerTpl, playerX, playerY, playerW, playerH, {
          elapsed: p.userDefeated ? 0 : elapsed,
          cellSize: 4,
          enable3D: true,
          enableGlow: !p.userDefeated,
          enableBgFill: true,
        });

        // Player hit white flash
        if (playerFlash > 0) {
          ctx.globalAlpha = playerFlash * 0.25;
          ctx.fillStyle = '#f44';
          ctx.fillRect(playerX, playerY, playerW, playerH);
        }

        // Defeated overlay
        if (p.userDefeated) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#000';
          ctx.fillRect(playerX, playerY, playerW, playerH);
        }

        ctx.restore();
      }

      // ── Left vignette (edge fade — lighter when player is rendered) ─

      const vigGrd = ctx.createLinearGradient(
        0,
        0,
        w * (playerTpl ? 0.06 : 0.15),
        0,
      );
      vigGrd.addColorStop(
        0,
        playerTpl ? 'rgba(10,10,8,0.2)' : 'rgba(10,10,8,0.4)',
      );
      vigGrd.addColorStop(1, 'rgba(10,10,8,0)');
      ctx.fillStyle = vigGrd;
      ctx.fillRect(0, 0, w * (playerTpl ? 0.06 : 0.15), h);

      // ── HUD: Names ─────────────────────────────────────────────────

      const hudPad = 12;

      // Player name — top-left
      drawPlayerName(ctx, p.userName, hudPad, hudPad, p.userDefeated);

      // Monster name — top-right
      drawMonsterName(
        ctx,
        p.monsterName,
        p.monsterLevel,
        w - hudPad,
        hudPad,
        p.monsterDefeated,
      );

      // Callout box removed — damage shown via BattleFloatingDamage overlay
    },
    [template, playerTemplate],
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
});
