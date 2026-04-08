/**
 * CharacterViewer — Rotatable ASCII character viewer.
 *
 * Renders the player's GLB model through the ASCII pipeline. Mouse/touch
 * drag rotates the model on the Y axis. Idle animation plays continuously.
 * All output is ASCII — Three.js renders offscreen, never shown directly.
 *
 * Usage:
 *   <CharacterViewer race={Race.Human} />
 */

import { Box, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Race } from '../../../utils/types';
import { useCanvas, getPointerPos } from '../hooks/useCanvas';
import { COLORS, fontString } from '../theme';

import {
  attachToSocket,
  getCreatureState,
  loadGLBCreature,
  makeGLBDrawFn,
} from './glbCreatureLoader';
import { loadItemModel, isItemModelReady, itemSlug, getItemModel } from './glbItemLoader';
import { renderMonster } from './MonsterAsciiRenderer';
import type { MonsterTemplate } from './monsterTemplates';

// ── GLB URL mapping (mirrors BattleSceneCanvas) ─────────────────────────

const RACE_GLB_URL: Record<number, string> = {
  [Race.Human]: '/models/creatures/human-animated.glb',
  [Race.Elf]: '/models/creatures/elf-animated.glb',
  [Race.Dwarf]: '/models/creatures/dwarf-animated.glb',
};

const DEFAULT_YAW = 0; // face camera for inspection (not 3/4 battle view)

// ── Drag state (mutated in events, no React state to avoid re-renders) ──

type DragState = {
  active: boolean;
  startX: number;
  startYaw: number;
  currentYaw: number;
};

// ── Component ───────────────────────────────────────────────────────────

export function CharacterViewer({
  race,
  height = 280,
  weaponName,
}: {
  race: Race;
  height?: number;
  /** Equipped weapon name from items.json — loads 3D model onto hand socket */
  weaponName?: string;
}) {
  const glbUrl = RACE_GLB_URL[race];
  const dragRef = useRef<DragState>({
    active: false,
    startX: 0,
    startYaw: DEFAULT_YAW,
    currentYaw: DEFAULT_YAW,
  });

  // Ensure the GLB is loaded (may already be cached from battle scene)
  useEffect(() => {
    if (!glbUrl) return;
    loadGLBCreature(glbUrl, 7, 7, DEFAULT_YAW, -0.08, { playerMode: true }).catch(() => {});
  }, [glbUrl]);

  // Load + attach equipped weapon to character's hand socket
  const weaponSlug = weaponName ? itemSlug(weaponName) : null;
  const weaponAttachedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!weaponSlug) {
      // Weapon un-equipped — remove attached model
      if (weaponAttachedRef.current && glbUrl) {
        const state = getCreatureState(glbUrl);
        const prev = state?.model?.getObjectByName('__equipped_weapon__');
        if (prev) prev.removeFromParent();
        weaponAttachedRef.current = null;
      }
      return;
    }
    loadItemModel(weaponSlug).catch(() => {});
  }, [weaponSlug, glbUrl]);

  // Build a MonsterTemplate-compatible object for renderMonster
  const template: MonsterTemplate | null = useMemo(() => {
    if (!glbUrl) return null;
    return {
      id: `viewer-${Race[race]?.toLowerCase() ?? 'unknown'}`,
      name: Race[race] ?? 'Character',
      gridWidth: 7,
      gridHeight: 7,
      monsterClass: 0 as const,
      level: 1,
      dynamic: true,
      draw: makeGLBDrawFn(glbUrl, 7, 7, drawLoadingFallback, DEFAULT_YAW),
    };
  }, [glbUrl, race]);

  // Apply yaw from drag to the Three.js model every frame
  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      if (!template) return;
      const { width, height: h } = ctx.canvas.getBoundingClientRect();
      if (width === 0 || h === 0) return;

      // Sync drag yaw to the 3D model
      if (glbUrl) {
        const state = getCreatureState(glbUrl);
        if (state?.model) {
          state.model.rotation.y = dragRef.current.currentYaw;

          // Attach weapon once both are loaded (one-time per weapon)
          if (weaponSlug && weaponAttachedRef.current !== weaponSlug && isItemModelReady(weaponSlug)) {
            const itemData = getItemModel(weaponSlug);
            if (itemData) {
              // Remove previously attached weapon if switching
              if (weaponAttachedRef.current) {
                const prev = state.model.getObjectByName('__equipped_weapon__');
                if (prev) prev.removeFromParent();
              }
              const clone = itemData.model.clone();
              clone.name = '__equipped_weapon__';
              clone.position.set(...itemData.offset);
              clone.rotation.set(...itemData.rotation);
              clone.scale.setScalar(itemData.scale);
              attachToSocket(state.model, clone, itemData.socket);
              weaponAttachedRef.current = weaponSlug;
            }
          }
        }
      }

      ctx.clearRect(0, 0, width, h);

      renderMonster(ctx, template, 0, 0, width, h, {
        elapsed,
        cellSize: 5,
        enable3D: true,
        enableGlow: true,
        enableBgFill: true,
      });

      // Drag hint
      drawDragHint(ctx, width, h, elapsed);
    },
    [template, glbUrl, weaponSlug],
  );

  const { canvasRef } = useCanvas({ onFrame, interactive: true });

  // ── Drag handlers ─────────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x } = getPointerPos(e, canvas);
      dragRef.current.active = true;
      dragRef.current.startX = x;
      dragRef.current.startYaw = dragRef.current.currentYaw;
      canvas.setPointerCapture(e.pointerId);
    },
    [canvasRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x } = getPointerPos(e, canvas);
      const dx = x - dragRef.current.startX;
      // Scale: full canvas width = PI rotation
      const { width } = canvas.getBoundingClientRect();
      dragRef.current.currentYaw = dragRef.current.startYaw + (dx / width) * Math.PI;
    },
    [canvasRef],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  if (!glbUrl) {
    return (
      <Box h={height} display="flex" alignItems="center" justifyContent="center">
        <Text color={COLORS.textMuted} fontSize="sm">No character model</Text>
      </Box>
    );
  }

  return (
    <Box
      position="relative"
      w="100%"
      h={`${height}px`}
      cursor="grab"
      userSelect="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Character viewer — drag to rotate"
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function drawLoadingFallback(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgb(20,18,15)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = fontString('mono', 12, 400);
  ctx.fillStyle = '#8A7E6A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading...', w / 2, h / 2);
}

function drawDragHint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
) {
  // Fade out after 4 seconds
  const fade = Math.max(0, 1 - elapsed / 4000);
  if (fade <= 0) return;

  ctx.save();
  ctx.globalAlpha = fade * 0.5;
  ctx.font = fontString('mono', 10, 400);
  ctx.fillStyle = '#8A7E6A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('drag to rotate', w / 2, h - 8);
  ctx.restore();
}
