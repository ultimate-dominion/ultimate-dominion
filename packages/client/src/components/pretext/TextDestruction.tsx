import { useCallback, useRef, useState } from 'react';
import { Box, Text, Button, Flex } from '@chakra-ui/react';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS, rarityColor } from './theme';

type CharParticle = {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  fontSize: number;
};

const ITEMS = [
  { name: 'Wraithblade', rarity: 'legendary' },
  { name: 'Spectral Cloak', rarity: 'epic' },
  { name: 'Obsidian Shield', rarity: 'rare' },
  { name: 'Iron Helm', rarity: 'uncommon' },
  { name: 'Rusted Dagger', rarity: 'worn' },
];

export function TextDestruction() {
  const { ready } = usePretextFonts();
  const [itemIdx, setItemIdx] = useState(0);
  const [destroyed, setDestroyed] = useState(false);
  const particlesRef = useRef<CharParticle[]>([]);
  const item = ITEMS[itemIdx];
  const color = rarityColor(item.rarity);
  const fontSize = 32;

  const destroy = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `700 ${fontSize}px Cinzel`;

    // Measure each character position
    const chars = Array.from(item.name);
    let x = 0;
    const positions: { char: string; x: number; width: number }[] = [];
    for (const char of chars) {
      const w = ctx.measureText(char).width;
      positions.push({ char, x, width: w });
      x += w;
    }
    const totalWidth = x;

    // Create particles from character positions
    const particles: CharParticle[] = positions.map((p, i) => {
      const angle = (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 1.5 + Math.random() * 3;
      return {
        char: p.char,
        x: p.x - totalWidth / 2,
        y: 0,
        vx: Math.sin(angle) * speed * (i < chars.length / 2 ? -1 : 1),
        vy: -Math.random() * 2 - 1,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.08,
        opacity: 1,
        color,
        fontSize,
      };
    });

    particlesRef.current = particles;
    setDestroyed(true);
  }, [item, color, fontSize]);

  const reset = useCallback(() => {
    setDestroyed(false);
    particlesRef.current = [];
    setItemIdx(i => (i + 1) % ITEMS.length);
  }, []);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.4;

    if (!destroyed) {
      // Draw intact item name
      ctx.font = `700 ${fontSize}px Cinzel`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillText(item.name, centerX, centerY);
      ctx.shadowBlur = 0;

      // Rarity label
      ctx.font = '400 14px Fira Code';
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(item.rarity.toUpperCase(), centerX, centerY + fontSize * 0.8);
      return;
    }

    // Animate particles
    const particles = particlesRef.current;
    const gravity = 0.005;
    let anyActive = false;

    for (const p of particles) {
      if (p.opacity <= 0.01) continue;
      anyActive = true;

      // Physics
      p.vy += gravity * dt;
      p.x += p.vx * dt * 0.3;
      p.y += p.vy * dt * 0.3;
      p.rotation += p.rotationSpeed * dt;
      p.opacity -= 0.0008 * dt;

      // Render
      ctx.save();
      ctx.translate(centerX + p.x, centerY + p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.font = `700 ${p.fontSize}px Cinzel`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.char, 0, 0);
      ctx.restore();
    }

    // Show "destroyed" text when particles fade
    if (!anyActive || particles.every(p => p.opacity < 0.3)) {
      const fadeIn = particles.every(p => p.opacity <= 0.01) ? 1 : 0.3;
      ctx.globalAlpha = fadeIn;
      ctx.font = '400 16px Cormorant Garamond';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Item destroyed.', centerX, centerY);
      ctx.globalAlpha = 1;
    }
  }, [destroyed, item, color, fontSize]);

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

  return (
    <Box position="relative" w="100%" h="100%">
      <Box
        position="absolute"
        top={0} left={0} right={0} bottom={0}
        bg={COLORS.bg}
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={4} left={0} right={0} textAlign="center" zIndex={1}>
        <Flex gap={2} justifyContent="center">
          {!destroyed ? (
            <Button
              size="sm"
              variant="outline"
              color={COLORS.danger}
              borderColor={COLORS.danger}
              onClick={destroy}
              _hover={{ bg: 'rgba(184,58,42,0.15)' }}
            >
              Destroy Item
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              color={COLORS.amber}
              borderColor={COLORS.border}
              onClick={reset}
              _hover={{ bg: COLORS.bgHover }}
            >
              Next Item
            </Button>
          )}
        </Flex>
      </Box>
    </Box>
  );
}
