import { useCallback, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { renderMonster } from './MonsterAsciiRenderer';
import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';
import type { MonsterTemplate } from './monsterTemplates';

/**
 * Renders a monster as ASCII art backdrop in the battle view.
 * Sits behind the monster's stats as an atmospheric layer,
 * scoped to the monster's half of the battle panel.
 */
export function BattleMonsterAscii({
  monsterName,
  defeated,
  hit,
}: {
  monsterName: string;
  defeated?: boolean;
  hit?: boolean;
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
      renderMonster(ctx, template, 0, 0, width, height, {
        elapsed: defeated ? 0 : elapsed,
        cellSize: 4,
        enable3D: false,
        enableGlow: !defeated,
        enableBgFill: true,
      });
    },
    [template, defeated],
  );

  const { canvasRef } = useCanvas({ onFrame, static: defeated });

  if (!template) return null;

  return (
    <Box
      position="absolute"
      top="0"
      left="0"
      right="0"
      bottom="0"
      zIndex={1}
      opacity={defeated ? 0.3 : hit ? 0 : 0.85}
      filter={defeated ? 'grayscale(100%)' : undefined}
      animation={hit ? 'flicker .7s infinite' : 'none'}
      pointerEvents="none"
    >
      <canvas ref={canvasRef as React.LegacyRef<HTMLCanvasElement>} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
