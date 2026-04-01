import { useCallback, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { renderMonster } from './MonsterAsciiRenderer';
import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';
import type { MonsterTemplate } from './monsterTemplates';

/**
 * Renders a monster as ASCII art in the battle view.
 * Looks up the template by name from MONSTER_TEMPLATES_REDUX,
 * falls back to null render if no match.
 */
export function BattleMonsterAscii({
  monsterName,
  defeated,
  hit,
  size = 96,
}: {
  monsterName: string;
  defeated?: boolean;
  hit?: boolean;
  size?: number;
}) {
  const template: MonsterTemplate | undefined = useMemo(
    () => MONSTER_TEMPLATES_REDUX.find((t) => t.name === monsterName),
    [monsterName],
  );

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      if (!template) return;
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      renderMonster(ctx, template, 0, 0, width, height, {
        elapsed,
        cellSize: 3,
        enable3D: false,
        enableGlow: false,
      });
    },
    [template],
  );

  const { canvasRef } = useCanvas({ onFrame });

  if (!template) return null;

  return (
    <Box
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="full"
      overflow="hidden"
      opacity={defeated ? 0.4 : hit ? 0 : 1}
      filter={defeated ? 'grayscale(100%)' : undefined}
      animation={hit ? 'flicker .7s infinite' : 'none'}
      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
    >
      <canvas ref={canvasRef as React.LegacyRef<HTMLCanvasElement>} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
