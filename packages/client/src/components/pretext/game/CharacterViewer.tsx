/**
 * CharacterViewer — Rotatable ASCII character viewer.
 *
 * Renders the player's GLB model through the ASCII pipeline. Mouse/touch
 * drag rotates the model on the Y axis. Idle animation plays continuously.
 * All output is ASCII — Three.js renders offscreen, never shown directly.
 *
 * Usage:
 *   <CharacterViewer race={Race.Human} />
 *   <CharacterViewer race={Race.Human} autoReveal equippedItems={[...]} />
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
const REVEAL_DURATION_MS = 8000;
const REVEAL_TOTAL_RAD = Math.PI * 2; // full 360

// ── Types ──────────────────────────────────────────────────────────────

export type EquippedItemSlot = {
  name: string;
  socket: string;
};

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
  cellSize = 5,
  autoReveal = false,
  equippedItems,
  // Legacy single-weapon prop (use equippedItems instead)
  weaponName,
}: {
  race: Race;
  height?: number;
  /** ASCII cell size — smaller = crisper but more CPU. Card: 6, fullscreen: 4 */
  cellSize?: number;
  /** Auto-rotate 360 degrees on mount then stop. The "trophy reveal" for inspection. */
  autoReveal?: boolean;
  /** Equipment to attach to bone sockets (weapons, armor visuals) */
  equippedItems?: EquippedItemSlot[];
  /** @deprecated Use equippedItems instead */
  weaponName?: string;
}) {
  const glbUrl = RACE_GLB_URL[race];
  const dragRef = useRef<DragState>({
    active: false,
    startX: 0,
    startYaw: DEFAULT_YAW,
    currentYaw: DEFAULT_YAW,
  });

  // Auto-reveal: track mount time for the spin animation
  const revealStartRef = useRef<number>(autoReveal ? performance.now() : -1);

  // Normalize equipment list: merge legacy weaponName with equippedItems
  const allItems = useMemo(() => {
    const items = equippedItems ? [...equippedItems] : [];
    if (weaponName && !items.some(i => i.name === weaponName)) {
      items.push({ name: weaponName, socket: 'hand_R.socket' });
    }
    return items;
  }, [equippedItems, weaponName]);

  // Track which items are currently attached (by socket → slug)
  const attachedRef = useRef<Map<string, string>>(new Map());

  // Ensure the GLB is loaded (may already be cached from battle scene)
  useEffect(() => {
    if (!glbUrl) return;
    loadGLBCreature(glbUrl, 7, 7, DEFAULT_YAW, -0.08, { playerMode: true }).catch(() => {});
  }, [glbUrl]);

  // Load all equipped item models
  useEffect(() => {
    for (const item of allItems) {
      const slug = itemSlug(item.name);
      if (slug) loadItemModel(slug).catch(() => {});
    }
  }, [allItems]);

  // Remove items that were unequipped
  useEffect(() => {
    if (!glbUrl) return;
    const state = getCreatureState(glbUrl);
    if (!state?.model) return;

    const currentSlugs = new Set(allItems.map(i => itemSlug(i.name)));
    for (const [socket, slug] of attachedRef.current.entries()) {
      if (!currentSlugs.has(slug)) {
        const nodeName = `__equipped_${socket}__`;
        const prev = state.model.getObjectByName(nodeName);
        if (prev) prev.removeFromParent();
        attachedRef.current.delete(socket);
      }
    }
  }, [allItems, glbUrl]);

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

  // Apply yaw from drag / autoReveal to the Three.js model every frame
  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      if (!template) return;
      const { width, height: h } = ctx.canvas.getBoundingClientRect();
      if (width === 0 || h === 0) return;

      // Auto-reveal rotation (only if not dragging)
      if (revealStartRef.current > 0 && !dragRef.current.active) {
        const revealElapsed = performance.now() - revealStartRef.current;
        if (revealElapsed < REVEAL_DURATION_MS) {
          // Smooth ease-out rotation
          const t = revealElapsed / REVEAL_DURATION_MS;
          const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
          dragRef.current.currentYaw = DEFAULT_YAW + REVEAL_TOTAL_RAD * eased;
        } else {
          // Snap to front and stop
          dragRef.current.currentYaw = DEFAULT_YAW;
          revealStartRef.current = -1;
        }
      }

      // Sync yaw to the 3D model
      if (glbUrl) {
        const state = getCreatureState(glbUrl);
        if (state?.model) {
          state.model.rotation.y = dragRef.current.currentYaw;

          // Attach equipment items as they become ready
          for (const item of allItems) {
            const slug = itemSlug(item.name);
            if (!slug || attachedRef.current.get(item.socket) === slug) continue;
            if (!isItemModelReady(slug)) continue;

            const itemData = getItemModel(slug);
            if (!itemData) continue;

            // Remove previous item on this socket
            const nodeName = `__equipped_${item.socket}__`;
            const prev = state.model.getObjectByName(nodeName);
            if (prev) prev.removeFromParent();

            const clone = itemData.model.clone();
            clone.name = nodeName;
            clone.position.set(...itemData.offset);
            clone.rotation.set(...itemData.rotation);
            clone.scale.setScalar(itemData.scale);
            attachToSocket(state.model, clone, item.socket);
            attachedRef.current.set(item.socket, slug);
          }
        }
      }

      ctx.clearRect(0, 0, width, h);

      renderMonster(ctx, template, 0, 0, width, h, {
        elapsed,
        cellSize,
        enable3D: true,
        enableGlow: true,
        enableBgFill: true,
      });

      // Drag hint (not shown during autoReveal)
      if (!autoReveal) {
        drawDragHint(ctx, width, h, elapsed);
      }
    },
    [template, glbUrl, allItems, cellSize, autoReveal],
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
      // Cancel autoReveal on user interaction
      revealStartRef.current = -1;
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
      role="img"
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
