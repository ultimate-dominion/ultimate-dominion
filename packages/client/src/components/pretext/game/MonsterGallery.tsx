/**
 * Monster Gallery — Lab demo showing all 11 Zone 1 monsters
 * rendered as ASCII art at multiple sizes.
 */

import { useCallback, useRef, useState } from 'react';
import { Box, Flex, Text, Button, HStack } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS, FONTS } from '../theme';
import { MONSTER_TEMPLATES, type MonsterTemplate } from './monsterTemplates';
import { renderMonster, type AnimAction, type AnimationState } from './MonsterAsciiRenderer';

// ---------------------------------------------------------------------------
// Size presets
// ---------------------------------------------------------------------------

type ViewSize = 'tile' | 'combat' | 'splash';

const SIZE_CONFIG: Record<ViewSize, { label: string; w: number; h: number }> = {
  tile: { label: 'Tile', w: 80, h: 80 },
  combat: { label: 'Combat', w: 280, h: 240 },
  splash: { label: 'Splash', w: 500, h: 400 },
};

const CLASS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'WAR', color: 'rgb(200,150,60)' },
  1: { label: 'ROG', color: 'rgb(130,165,200)' },
  2: { label: 'MAG', color: 'rgb(160,100,180)' },
};

// ---------------------------------------------------------------------------
// Single monster canvas
// ---------------------------------------------------------------------------

function MonsterPreview({
  template,
  viewSize,
  selected,
  onClick,
}: {
  template: MonsterTemplate;
  viewSize: ViewSize;
  selected: boolean;
  onClick: () => void;
}) {
  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // Reserve space for label
      const labelH = viewSize === 'tile' ? 0 : 30;
      const monsterH = height - labelH;

      const cellSize = viewSize === 'tile' ? 3 : viewSize === 'combat' ? 4 : 3;
      renderMonster(ctx, template, 0, 0, width, monsterH, { elapsed, cellSize });

      // Name label (skip on tile view)
      if (viewSize !== 'tile') {
        const classInfo = CLASS_LABELS[template.monsterClass];
        ctx.font = `600 12px ${FONTS.heading}`;
        ctx.fillStyle = COLORS.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(template.name, width / 2, height - 4);

        // Level + class badge
        ctx.font = `400 9px ${FONTS.mono}`;
        ctx.fillStyle = classInfo.color;
        ctx.fillText(
          `L${template.level} ${classInfo.label}${template.isBoss ? ' BOSS' : ''}`,
          width / 2,
          height - 18,
        );
      }
    },
    [template, viewSize],
  );

  const { canvasRef } = useCanvas({ onFrame });
  const config = SIZE_CONFIG[viewSize];

  return (
    <Box
      as="button"
      w={`${config.w}px`}
      h={`${config.h}px`}
      position="relative"
      borderRadius="md"
      overflow="hidden"
      border="1px solid"
      borderColor={selected ? COLORS.amber : COLORS.border}
      cursor="pointer"
      onClick={onClick}
      _hover={{ borderColor: COLORS.amber }}
      transition="border-color 0.15s"
      flexShrink={0}
    >
      <canvas
        ref={canvasRef as React.Ref<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Expanded single-monster view
// ---------------------------------------------------------------------------

function MonsterExpanded({
  template,
  animRef,
}: {
  template: MonsterTemplate;
  animRef: React.MutableRefObject<AnimationState | undefined>;
}) {
  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      renderMonster(ctx, template, 0, 0, width, height - 50, {
        elapsed,
        cellSize: 3,
        animation: animRef.current,
      });

      // Info
      const classInfo = CLASS_LABELS[template.monsterClass];
      ctx.font = `700 20px ${FONTS.heading}`;
      ctx.fillStyle = COLORS.textPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(template.name, width / 2, height - 8);

      ctx.font = `400 12px ${FONTS.mono}`;
      ctx.fillStyle = classInfo.color;
      ctx.fillText(
        `Level ${template.level} | ${classInfo.label}${template.isBoss ? ' | BOSS' : ''} | ${template.gridWidth}x${template.gridHeight} grid`,
        width / 2,
        height - 32,
      );
    },
    [template, animRef],
  );

  const { canvasRef } = useCanvas({ onFrame });

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      borderRadius="md"
      overflow="hidden"
      border="1px solid"
      borderColor={COLORS.border}
    >
      <canvas
        ref={canvasRef as React.Ref<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

const ATTACK_BUTTONS: { action: AnimAction; label: string; color: string }[] = [
  { action: 'fangs', label: 'Basilisk Fangs', color: 'rgb(200,150,60)' },
  { action: 'gaze', label: 'Petrifying Gaze', color: 'rgb(60,220,60)' },
  { action: 'hit', label: 'Take Hit', color: 'rgb(220,80,60)' },
  { action: 'enrage', label: 'Enrage', color: 'rgb(220,50,30)' },
  { action: 'death', label: 'Death', color: 'rgb(120,120,140)' },
];

export function MonsterGallery() {
  const { ready } = usePretextFonts();
  const [viewSize, setViewSize] = useState<ViewSize>('combat');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const animRef = useRef<AnimationState | undefined>(undefined);
  const [activeAction, setActiveAction] = useState<AnimAction>('idle');

  const selectedTemplate = selectedId
    ? MONSTER_TEMPLATES.find((t) => t.id === selectedId)
    : null;

  const triggerAnimation = useCallback((action: AnimAction) => {
    animRef.current = { action, startTime: performance.now() };
    setActiveAction(action);
    if (action !== 'death') {
      // Auto-return to idle after animation duration
      const durations: Record<string, number> = {
        fangs: 900, gaze: 1200, hit: 500, enrage: 800,
      };
      const dur = durations[action] ?? 1000;
      setTimeout(() => {
        animRef.current = undefined;
        setActiveAction('idle');
      }, dur);
    }
  }, []);

  if (!ready) {
    return (
      <Box p={4}>
        <Text color={COLORS.textBody}>Loading fonts...</Text>
      </Box>
    );
  }

  return (
    <Flex direction="column" h="100%" gap={3}>
      {/* Controls */}
      <Flex justify="space-between" align="center" px={2}>
        <Text fontFamily="heading" fontSize="sm" color={COLORS.textPrimary}>
          {selectedTemplate
            ? `${selectedTemplate.name} — Hi-Res`
            : `Zone 1 Monsters (${MONSTER_TEMPLATES.length})`}
        </Text>
        <HStack spacing={1}>
          {selectedTemplate && (
            <Button
              size="xs"
              variant="outline"
              color={COLORS.textBody}
              borderColor={COLORS.border}
              onClick={() => {
                setSelectedId(null);
                animRef.current = undefined;
                setActiveAction('idle');
              }}
              _hover={{ bg: COLORS.bgHover }}
              mr={2}
            >
              Back
            </Button>
          )}
          {!selectedTemplate &&
            (['tile', 'combat', 'splash'] as ViewSize[]).map((size) => (
              <Button
                key={size}
                size="xs"
                variant={viewSize === size ? 'solid' : 'outline'}
                bg={viewSize === size ? COLORS.amber : 'transparent'}
                color={viewSize === size ? COLORS.bg : COLORS.textBody}
                borderColor={COLORS.border}
                onClick={() => setViewSize(size)}
                _hover={{ bg: viewSize === size ? COLORS.amber : COLORS.bgHover }}
              >
                {SIZE_CONFIG[size].label}
              </Button>
            ))}
        </HStack>
      </Flex>

      {/* Content */}
      {selectedTemplate ? (
        <Box flex={1} position="relative">
          <MonsterExpanded template={selectedTemplate} animRef={animRef} />
          {/* Animation controls */}
          <HStack
            position="absolute"
            bottom={14}
            left="50%"
            transform="translateX(-50%)"
            spacing={1}
            bg="rgba(0,0,0,0.7)"
            px={3}
            py={1.5}
            borderRadius="md"
          >
            {ATTACK_BUTTONS.map(({ action, label, color }) => (
              <Button
                key={action}
                size="xs"
                variant="outline"
                color={activeAction === action ? COLORS.bg : color}
                bg={activeAction === action ? color : 'transparent'}
                borderColor={color}
                onClick={() => triggerAnimation(action)}
                isDisabled={activeAction !== 'idle' && activeAction !== action}
                _hover={{ bg: activeAction === action ? color : 'rgba(255,255,255,0.05)' }}
                _disabled={{ opacity: 0.4, cursor: 'not-allowed' }}
                fontFamily="mono"
                fontSize="10px"
              >
                {label}
              </Button>
            ))}
          </HStack>
        </Box>
      ) : (
        <Box flex={1} overflowY="auto" px={2}>
          <Flex flexWrap="wrap" gap={3} justifyContent="center">
            {MONSTER_TEMPLATES.map((t) => (
              <MonsterPreview
                key={t.id}
                template={t}
                viewSize={viewSize}
                selected={selectedId === t.id}
                onClick={() => setSelectedId(t.id)}
              />
            ))}
          </Flex>
        </Box>
      )}
    </Flex>
  );
}
