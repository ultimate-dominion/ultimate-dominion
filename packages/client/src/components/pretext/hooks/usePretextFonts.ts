import { useState, useEffect } from 'react';
import {
  prepare,
  prepareWithSegments,
  layout,
  layoutWithLines,
  layoutNextLine,
  type PreparedText,
  type PreparedTextWithSegments,
  type LayoutResult,
  type LayoutLinesResult,
  type LayoutLine,
  type LayoutCursor,
} from '@chenglou/pretext';
import { FONTS, fontString } from '../theme';

export type FontKey =
  | 'cormorant-400'
  | 'cormorant-500'
  | 'cormorant-600'
  | 'cormorant-700'
  | 'cormorant-400-italic'
  | 'cinzel-400'
  | 'cinzel-500'
  | 'cinzel-600'
  | 'cinzel-700'
  | 'firaCode-300'
  | 'firaCode-400'
  | 'firaCode-500'
  | 'firaCode-600'
  | 'firaCode-700'
  | 'inter-400'
  | 'inter-500'
  | 'inter-600'
  | 'inter-700';

// Map FontKey to family + weight + style
const FONT_KEY_MAP: Record<FontKey, { family: keyof typeof FONTS; weight: number; style: 'normal' | 'italic' }> = {
  'cormorant-400': { family: 'serif', weight: 400, style: 'normal' },
  'cormorant-500': { family: 'serif', weight: 500, style: 'normal' },
  'cormorant-600': { family: 'serif', weight: 600, style: 'normal' },
  'cormorant-700': { family: 'serif', weight: 700, style: 'normal' },
  'cormorant-400-italic': { family: 'serif', weight: 400, style: 'italic' },
  'cinzel-400': { family: 'heading', weight: 400, style: 'normal' },
  'cinzel-500': { family: 'heading', weight: 500, style: 'normal' },
  'cinzel-600': { family: 'heading', weight: 600, style: 'normal' },
  'cinzel-700': { family: 'heading', weight: 700, style: 'normal' },
  'firaCode-300': { family: 'mono', weight: 300, style: 'normal' },
  'firaCode-400': { family: 'mono', weight: 400, style: 'normal' },
  'firaCode-500': { family: 'mono', weight: 500, style: 'normal' },
  'firaCode-600': { family: 'mono', weight: 600, style: 'normal' },
  'firaCode-700': { family: 'mono', weight: 700, style: 'normal' },
  'inter-400': { family: 'ui', weight: 400, style: 'normal' },
  'inter-500': { family: 'ui', weight: 500, style: 'normal' },
  'inter-600': { family: 'ui', weight: 600, style: 'normal' },
  'inter-700': { family: 'ui', weight: 700, style: 'normal' },
};

/** Build a CSS font string for a given FontKey at a specific pixel size */
export function getFontString(key: FontKey, size: number): string {
  const { family, weight, style } = FONT_KEY_MAP[key];
  return fontString(family, size, weight, style);
}

// Module-level font readiness state
let fontsReady = false;
let fontsReadyPromise: Promise<void> | null = null;

function ensureFontsReady(): Promise<void> {
  if (fontsReady) return Promise.resolve();
  if (fontsReadyPromise) return fontsReadyPromise;
  fontsReadyPromise = document.fonts.ready.then(() => {
    fontsReady = true;
  });
  return fontsReadyPromise;
}

/**
 * Hook that waits for fonts to load then provides Pretext measurement utilities.
 */
export function usePretextFonts() {
  const [ready, setReady] = useState(fontsReady);

  useEffect(() => {
    if (fontsReady) {
      setReady(true);
      return;
    }
    ensureFontsReady().then(() => setReady(true));
  }, []);

  return {
    ready,
    /** Prepare text for fast layout (opaque handle, height/lineCount only) */
    prepare: (text: string, font: string) => prepare(text, font),
    /** Prepare text with segment data for custom rendering */
    prepareWithSegments: (text: string, font: string) => prepareWithSegments(text, font),
    /** Fast layout: returns height and lineCount */
    layout: (prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult =>
      layout(prepared, maxWidth, lineHeight),
    /** Layout with full line data for custom rendering */
    layoutWithLines: (prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): LayoutLinesResult =>
      layoutWithLines(prepared, maxWidth, lineHeight),
    /** Iterator-style: get next line from cursor position */
    layoutNextLine: (prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number): LayoutLine | null =>
      layoutNextLine(prepared, start, maxWidth),
    /** Get the CSS font string for a FontKey at given size */
    getFontString,
  };
}

export type PretextFonts = ReturnType<typeof usePretextFonts>;

// Re-export types for convenience
export type {
  PreparedText,
  PreparedTextWithSegments,
  LayoutResult,
  LayoutLinesResult,
  LayoutLine,
  LayoutCursor,
};
