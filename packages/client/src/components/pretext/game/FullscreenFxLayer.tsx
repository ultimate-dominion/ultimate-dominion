/**
 * FullscreenFxLayer — Full-screen ASCII effect overlay for boss moments.
 *
 * Sits above the battle canvas (zIndex: 1000), pointer-events: none so the
 * player can still interact with the game UI behind it.
 *
 * Imperative API via ref:
 *   const fxRef = useRef<FullscreenFxHandle>(null);
 *   fxRef.current?.triggerFx('boss_entry', { monsterName: 'Basilisk', color: [180, 130, 40] });
 *   fxRef.current?.triggerFx('enrage');
 *   fxRef.current?.triggerFx('signature_attack', { creature: 'basilisk' });
 *   fxRef.current?.triggerFx('death', { monsterName: 'Basilisk', color: [100, 180, 60] });
 *   fxRef.current?.triggerFx('world_event', { message: 'The Basilisk has fallen.' });
 *
 * Allowed triggers (Kaplan rules): boss_entry, enrage, signature_attack, death, world_event.
 * Max duration: 1200ms. Not skippable — keep short.
 */

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { FullscreenFxController, type FxTrigger, type FxPayload } from './fullscreenFx';

// ── Public handle type ────────────────────────────────────────────────────

export type FullscreenFxHandle = {
  triggerFx: (trigger: FxTrigger, payload?: FxPayload) => void;
};

// ── Component ─────────────────────────────────────────────────────────────

export const FullscreenFxLayer = forwardRef<FullscreenFxHandle>(
  function FullscreenFxLayer(_props, ref) {
    const controllerRef = useRef<FullscreenFxController>(new FullscreenFxController());

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      triggerFx(trigger: FxTrigger, payload: FxPayload = {}) {
        controllerRef.current.trigger(trigger, payload);
      },
    }), []);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas;
      const controller = controllerRef.current;

      // Advance controller state
      const hasActive = controller.tick();

      if (!hasActive) {
        // Nothing to draw — clear to transparent
        ctx.clearRect(0, 0, width, height);
        return;
      }

      // Clear before drawing this frame's effect
      ctx.clearRect(0, 0, width, height);
      controller.draw(ctx, width, height);
    }, []);

    const { canvasRef } = useCanvas({ onFrame });

    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={1000}
        pointerEvents="none"
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
    );
  },
);
