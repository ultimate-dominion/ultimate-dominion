import { useRef, useEffect, useState, useCallback } from 'react';

export type FrameCallback = (
  ctx: CanvasRenderingContext2D,
  dt: number,
  elapsed: number,
) => void;

export type CanvasOptions = {
  /** Called each animation frame with context, delta time (ms), and elapsed time (ms) */
  onFrame?: FrameCallback;
  /** Called when canvas resizes */
  onResize?: (width: number, height: number) => void;
  /** Enable pointer/touch event forwarding */
  interactive?: boolean;
};

export type CanvasState = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ctx: CanvasRenderingContext2D | null;
  /** CSS pixel width */
  width: number;
  /** CSS pixel height */
  height: number;
  /** Device pixel ratio */
  dpr: number;
};

/**
 * Shared canvas hook with DPI scaling, ResizeObserver, and RAF loop.
 * Every Pretext demo component uses this.
 */
export function useCanvas(options: CanvasOptions = {}): CanvasState {
  const { onFrame, onResize, interactive = false } = options;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Store latest callbacks in refs to avoid RAF loop restart on every render
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  // Initialize context and ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    setCtx(context);

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      // Set canvas pixel dimensions (DPI-scaled)
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // Set CSS display size
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // Scale context for DPI
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      setSize({ width: w, height: h });
      onResizeRef.current?.(w, h);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas.parentElement!);

    return () => observer.disconnect();
  }, [dpr]);

  // RAF loop
  useEffect(() => {
    if (!ctx || !onFrameRef.current) return;

    let rafId: number;
    let lastTime = performance.now();
    const startTime = lastTime;

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      onFrameRef.current?.(ctx, dt, now - startTime);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [ctx]);

  // Touch event normalization for interactive canvases
  useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevent default touch behavior (scroll, zoom) on the canvas
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, [interactive]);

  return { canvasRef, ctx, width: size.width, height: size.height, dpr };
}

/**
 * Get pointer position relative to canvas (handles touch + mouse, DPI-aware).
 */
export function getPointerPos(
  e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  let clientX: number, clientY: number;

  if ('touches' in e) {
    const touch = e.touches[0] || e.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}
