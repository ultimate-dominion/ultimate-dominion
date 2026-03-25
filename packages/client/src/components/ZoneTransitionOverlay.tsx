import { useMemo, useState, useEffect } from 'react';
import { Box, Button, keyframes, Text } from '@chakra-ui/react';

/* ──────────────────────── Wind Peaks Palette ──────────────────────── */

const PEAKS = {
  stone: '#8B9DAF',
  sky: '#B4C6D4',
  frost: '#C8D8E8',
  warmStone: '#A8957E',
  deepSky: '#6B7F94',
  lightText: '#D4E0EC',
  dimText: '#7A8D9E',
  darkBase: '#12100E',
  caveAmber: '#C87A2A',
  caveGold: '#D4A54A',
};

/* ──────────────────────── Keyframes ──────────────────────── */

/** Full-screen darkening + subtle downward settle */
const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/** Cave ceiling texture — subtle shift before the crack */
const ceilingRumble = keyframes`
  0%   { transform: translate(0, 0); }
  10%  { transform: translate(-1px, 1px); }
  20%  { transform: translate(1px, -1px); }
  30%  { transform: translate(-1px, -1px); }
  40%  { transform: translate(1px, 1px); }
  50%  { transform: translate(0, -1px); }
  60%  { transform: translate(-1px, 0); }
  70%  { transform: translate(1px, 1px); }
  80%  { transform: translate(0, -1px); }
  90%  { transform: translate(-1px, 1px); }
  100% { transform: translate(0, 0); }
`;

/** The central crack widens — clip-path polygon that splits the screen */
const crackOpen = keyframes`
  0%   { clip-path: polygon(49.8% 0%, 50.2% 0%, 50.2% 100%, 49.8% 100%); opacity: 0; }
  15%  { clip-path: polygon(49.8% 0%, 50.2% 0%, 50.2% 100%, 49.8% 100%); opacity: 1; }
  40%  { clip-path: polygon(48% 0%, 52% 0%, 53% 100%, 47% 100%); opacity: 1; }
  70%  { clip-path: polygon(35% 0%, 65% 0%, 70% 100%, 30% 100%); opacity: 1; }
  100% { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); opacity: 1; }
`;

/** Light rays expanding from crack center */
const lightRays = keyframes`
  0%   { opacity: 0; transform: scaleX(0.02); }
  20%  { opacity: 0.6; transform: scaleX(0.05); }
  50%  { opacity: 0.8; transform: scaleX(0.3); }
  80%  { opacity: 0.4; transform: scaleX(1.2); }
  100% { opacity: 0; transform: scaleX(1.5); }
`;

/** Amber-to-blue color shift on the light seam */
const colorShift = keyframes`
  0%   { background: linear-gradient(180deg, rgba(200,122,42,0.6) 0%, rgba(200,122,42,0.2) 100%); }
  40%  { background: linear-gradient(180deg, rgba(200,122,42,0.4) 0%, rgba(139,157,175,0.3) 50%, rgba(180,198,212,0.2) 100%); }
  100% { background: linear-gradient(180deg, rgba(180,198,212,0.5) 0%, rgba(139,157,175,0.3) 50%, rgba(107,127,148,0.1) 100%); }
`;

/** Mountain range rising from below */
const mountainRise = keyframes`
  0%   { transform: translateY(100%); opacity: 0; }
  60%  { transform: translateY(5%); opacity: 0.7; }
  100% { transform: translateY(0%); opacity: 1; }
`;

/** Wind particle drift — left to right with vertical wobble */
const windDrift = keyframes`
  0%   { transform: translateX(-10vw) translateY(0px); opacity: 0; }
  10%  { opacity: 0.6; }
  50%  { transform: translateX(50vw) translateY(-8px); opacity: 0.4; }
  90%  { opacity: 0.1; }
  100% { transform: translateX(110vw) translateY(4px); opacity: 0; }
`;

/** Slow ambient wind for larger particles */
const windDriftSlow = keyframes`
  0%   { transform: translateX(-5vw) translateY(0px); opacity: 0; }
  15%  { opacity: 0.3; }
  50%  { transform: translateX(40vw) translateY(-12px); opacity: 0.25; }
  85%  { opacity: 0.08; }
  100% { transform: translateX(105vw) translateY(6px); opacity: 0; }
`;

/** Zone title letter-by-letter stagger with wind nudge */
const letterReveal = keyframes`
  0%   { opacity: 0; transform: translateX(-20px) translateY(4px); filter: blur(4px); }
  40%  { opacity: 1; transform: translateX(3px) translateY(-1px); filter: blur(0); }
  60%  { transform: translateX(-1px) translateY(0px); }
  100% { opacity: 1; transform: translateX(0) translateY(0); filter: blur(0); }
`;

/** Subtitle and narrative fade-up */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/** Gentle pulsing glow on the zone title */
const peakGlow = keyframes`
  0%, 100% { text-shadow: 0 0 20px rgba(180,198,212,0.3), 0 0 60px rgba(139,157,175,0.15); }
  50%      { text-shadow: 0 0 30px rgba(180,198,212,0.5), 0 0 80px rgba(139,157,175,0.25); }
`;

/** Crack glow — amber line at the split point */
const crackEdgeGlow = keyframes`
  0%   { opacity: 0; box-shadow: 0 0 4px rgba(200,122,42,0.4); }
  30%  { opacity: 1; box-shadow: 0 0 20px rgba(200,122,42,0.8), 0 0 40px rgba(200,122,42,0.4); }
  60%  { opacity: 0.8; box-shadow: 0 0 12px rgba(180,198,212,0.5), 0 0 30px rgba(139,157,175,0.3); }
  100% { opacity: 0; }
`;

/** Final overlay exit */
const exitFade = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; }
`;

/* ──────────────────────── Mountain SVG ──────────────────────── */

const MountainSilhouette = () => (
  <Box
    as="svg"
    viewBox="0 0 1200 300"
    position="absolute"
    bottom={0}
    left={0}
    right={0}
    w="100%"
    h="auto"
    preserveAspectRatio="none"
    opacity={0}
    animation={`${mountainRise} 2.5s 5s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
    zIndex={2}
  >
    {/* Far range — darker, blurred */}
    <path
      d="M0 300 L0 180 L80 120 L140 155 L200 90 L280 140 L340 75 L400 130 L480 60 L540 110 L620 50 L700 100 L760 45 L830 95 L900 55 L960 105 L1020 70 L1080 120 L1140 80 L1200 140 L1200 300 Z"
      fill={PEAKS.deepSky}
      opacity={0.4}
    />
    {/* Mid range — the main peaks */}
    <path
      d="M0 300 L0 200 L60 170 L120 210 L180 140 L240 185 L320 110 L380 160 L440 100 L520 150 L580 90 L660 135 L720 80 L800 130 L860 95 L940 145 L1000 105 L1060 160 L1120 120 L1200 175 L1200 300 Z"
      fill={PEAKS.stone}
      opacity={0.5}
    />
    {/* Near range — foreground silhouette */}
    <path
      d="M0 300 L0 240 L100 210 L180 250 L260 190 L360 230 L440 180 L540 220 L640 175 L740 215 L820 185 L920 225 L1000 195 L1100 235 L1200 205 L1200 300 Z"
      fill={PEAKS.deepSky}
      opacity={0.7}
    />
  </Box>
);

/* ──────────────────────── Wind Particles ──────────────────────── */

type WindParticle = {
  id: number;
  top: string;
  width: string;
  height: string;
  delay: string;
  duration: string;
  opacity: number;
  isSlow: boolean;
};

const generateWindParticles = (): WindParticle[] => {
  const particles: WindParticle[] = [];
  for (let i = 0; i < 28; i++) {
    const isSlow = i % 4 === 0;
    particles.push({
      id: i,
      top: `${8 + Math.random() * 75}%`,
      width: isSlow ? `${20 + Math.random() * 40}px` : `${6 + Math.random() * 18}px`,
      height: isSlow ? '1.5px' : '1px',
      delay: `${5.5 + Math.random() * 3}s`,
      duration: isSlow ? `${5 + Math.random() * 3}s` : `${2.5 + Math.random() * 2}s`,
      opacity: isSlow ? 0.15 + Math.random() * 0.12 : 0.2 + Math.random() * 0.3,
      isSlow,
    });
  }
  return particles;
};

/* ──────────────────────── Cave Texture Layers ──────────────────────── */

/** Procedural rock texture using layered CSS gradients */
const CaveTexture = ({ side }: { side: 'left' | 'right' }) => (
  <Box
    position="absolute"
    top={0}
    bottom={0}
    {...(side === 'left' ? { left: 0, right: '50%' } : { left: '50%', right: 0 })}
    bg={`
      radial-gradient(ellipse at ${side === 'left' ? '80%' : '20%'} 30%, rgba(58,50,40,0.6) 0%, transparent 60%),
      radial-gradient(ellipse at ${side === 'left' ? '60%' : '40%'} 70%, rgba(58,50,40,0.4) 0%, transparent 50%),
      radial-gradient(ellipse at ${side === 'left' ? '90%' : '10%'} 50%, rgba(28,24,20,0.8) 0%, transparent 40%),
      linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${PEAKS.darkBase} 0%, rgba(28,24,20,0.95) 60%, rgba(28,24,20,0.3) 100%)
    `}
    zIndex={4}
    pointerEvents="none"
  />
);

/* ──────────────────────── Zone Title ──────────────────────── */

const ZONE_NAME = 'WINDY PEAKS';
const SUBTITLE = 'The mountain range above Noctum\'s Wound';

const ZoneTitle = () => (
  <Box
    position="absolute"
    top="50%"
    left="50%"
    transform="translate(-50%, -50%)"
    zIndex={10}
    textAlign="center"
    w="100%"
    px={4}
  >
    {/* Main title — letters stagger in */}
    <Box
      display="flex"
      justifyContent="center"
      gap={{ base: '4px', md: '8px' }}
      mb={4}
    >
      {ZONE_NAME.split('').map((char, i) => (
        <Text
          key={i}
          as="span"
          display="inline-block"
          fontFamily="'Cinzel', serif"
          fontSize={{ base: '3xl', md: '5xl', lg: '6xl' }}
          fontWeight={700}
          color={PEAKS.lightText}
          letterSpacing="0.15em"
          opacity={0}
          animation={`${letterReveal} 0.8s ${7 + i * 0.08}s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
          minW={char === ' ' ? { base: '12px', md: '20px' } : undefined}
        >
          {char === ' ' ? '\u00A0' : char}
        </Text>
      ))}
    </Box>

    {/* Glow overlay on the assembled title — kicks in after all letters land */}
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      w="100%"
      opacity={0}
      animation={`${fadeUp} 0.5s 8.5s ease-out forwards`}
      pointerEvents="none"
    >
      <Text
        fontFamily="'Cinzel', serif"
        fontSize={{ base: '3xl', md: '5xl', lg: '6xl' }}
        fontWeight={700}
        color="transparent"
        letterSpacing="0.15em"
        animation={`${peakGlow} 4s 9s ease-in-out infinite`}
      >
        {ZONE_NAME}
      </Text>
    </Box>

    {/* Decorative line */}
    <Box
      mx="auto"
      w="80px"
      h="1px"
      bg={`linear-gradient(90deg, transparent, ${PEAKS.stone}, transparent)`}
      opacity={0}
      animation={`${fadeUp} 0.8s 8.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
      mb={4}
    />

    {/* Subtitle */}
    <Text
      fontFamily="'Cinzel', serif"
      fontSize={{ base: 'xs', md: 'sm' }}
      fontStyle="italic"
      color={PEAKS.dimText}
      letterSpacing="0.08em"
      opacity={0}
      animation={`${fadeUp} 0.8s 9.2s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
    >
      {SUBTITLE}
    </Text>
  </Box>
);

/* ──────────────────────── Main Component ──────────────────────── */

type ZoneTransitionOverlayProps = {
  onComplete: () => void;
};

export const ZoneTransitionOverlay = ({
  onComplete,
}: ZoneTransitionOverlayProps): JSX.Element => {
  const [isExiting, setIsExiting] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);
  const [phase, setPhase] = useState<'crack' | 'open' | 'vista' | 'ready'>('crack');

  const windParticles = useMemo(generateWindParticles, []);

  // Phase progression
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('open'), 2500),
      setTimeout(() => setPhase('vista'), 5000),
      setTimeout(() => {
        setPhase('ready');
        setButtonReady(true);
      }, 10000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleContinue = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(onComplete, 800);
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg={PEAKS.darkBase}
      zIndex={9999}
      overflow="hidden"
      animation={isExiting ? `${exitFade} 0.8s ease-out forwards` : `${overlayFadeIn} 0.5s ease-out`}
    >
      {/* ── Layer 0: Sky gradient (revealed by crack) ── */}
      <Box
        position="absolute"
        inset={0}
        bg={`
          radial-gradient(ellipse at 50% 30%, rgba(180,198,212,0.15) 0%, transparent 50%),
          linear-gradient(180deg,
            ${PEAKS.deepSky} 0%,
            ${PEAKS.stone} 30%,
            rgba(139,157,175,0.3) 60%,
            ${PEAKS.darkBase} 100%
          )
        `}
        opacity={0}
        animation={`${crackOpen} 5s 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards`}
        zIndex={1}
      />

      {/* ── Layer 1: Cave ceiling (the thing that cracks) ── */}
      <Box
        position="absolute"
        inset={0}
        zIndex={3}
        pointerEvents="none"
        animation={phase !== 'crack' ? undefined : `${ceilingRumble} 0.6s 0.8s ease-in-out 3`}
      >
        <CaveTexture side="left" />
        <CaveTexture side="right" />

        {/* The crack seam — vertical line at center */}
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left="50%"
          transform="translateX(-50%)"
          w="2px"
          zIndex={5}
          animation={`${crackEdgeGlow} 3s 1s ease-in-out forwards`}
        />
      </Box>

      {/* ── Cave halves splitting apart ── */}
      <Box
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right="50%"
        bg={PEAKS.darkBase}
        zIndex={3}
        transform="translateX(0)"
        transition="transform 3.5s cubic-bezier(0.16, 1, 0.3, 1)"
        css={phase !== 'crack' ? { transform: 'translateX(-100%)' } : undefined}
        pointerEvents="none"
      >
        <CaveTexture side="left" />
      </Box>
      <Box
        position="absolute"
        top={0}
        bottom={0}
        left="50%"
        right={0}
        bg={PEAKS.darkBase}
        zIndex={3}
        transform="translateX(0)"
        transition="transform 3.5s cubic-bezier(0.16, 1, 0.3, 1)"
        css={phase !== 'crack' ? { transform: 'translateX(100%)' } : undefined}
        pointerEvents="none"
      >
        <CaveTexture side="right" />
      </Box>

      {/* ── Light rays from crack center ── */}
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          position="absolute"
          top={`${15 + i * 15}%`}
          left="50%"
          transform="translateX(-50%)"
          w="100%"
          h="2px"
          zIndex={2}
          transformOrigin="center"
          opacity={0}
          animation={`${lightRays} 2s ${1.8 + i * 0.2}s ease-out forwards`}
          pointerEvents="none"
        >
          <Box
            w="100%"
            h="100%"
            opacity={0}
            animation={`${colorShift} 3s ${1.8 + i * 0.2}s ease-out forwards`}
          />
        </Box>
      ))}

      {/* ── Mountain silhouettes ── */}
      <MountainSilhouette />

      {/* ── Wind particles ── */}
      {windParticles.map((p) => (
        <Box
          key={p.id}
          position="absolute"
          top={p.top}
          left={0}
          w={p.width}
          h={p.height}
          bg={p.isSlow
            ? `linear-gradient(90deg, transparent, ${PEAKS.frost}, transparent)`
            : `linear-gradient(90deg, transparent, ${PEAKS.sky}, transparent)`
          }
          borderRadius="full"
          opacity={0}
          animation={`${p.isSlow ? windDriftSlow : windDrift} ${p.duration} ${p.delay} ease-in-out infinite`}
          zIndex={5}
          pointerEvents="none"
        />
      ))}

      {/* ── Zone Title ── */}
      <ZoneTitle />

      {/* ── Narrative text ── */}
      <Box
        position="absolute"
        bottom={{ base: '20%', md: '18%' }}
        left="50%"
        transform="translateX(-50%)"
        w="100%"
        maxW="480px"
        px={6}
        zIndex={10}
        textAlign="center"
      >
        <Text
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize={{ base: 'sm', md: 'md' }}
          fontStyle="italic"
          lineHeight="1.85"
          color={PEAKS.dimText}
          opacity={0}
          animation={`${fadeUp} 1s 9.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
          textShadow="0 1px 4px rgba(0, 0, 0, 0.5)"
          whiteSpace="pre-line"
        >
          {'Wind-blasted stone, ancient roads, and the echo of a dead war god.\nThe first time you see the sky — and realize the world it belongs to is dying.'}
        </Text>
      </Box>

      {/* ── Continue button ── */}
      <Box
        position="absolute"
        bottom={{ base: '8%', md: '8%' }}
        left="50%"
        transform="translateX(-50%)"
        zIndex={10}
      >
        <Button
          onClick={handleContinue}
          variant="outline"
          size="md"
          opacity={0}
          pointerEvents={buttonReady ? 'auto' : 'none'}
          animation={`${fadeUp} 0.6s 10.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
          borderColor={PEAKS.stone}
          color={PEAKS.lightText}
          _hover={{
            bg: 'rgba(139, 157, 175, 0.15)',
            borderColor: PEAKS.sky,
          }}
          fontFamily="'Cinzel', serif"
          letterSpacing="0.1em"
          textTransform="uppercase"
          fontSize="sm"
        >
          Enter the Peaks
        </Button>
      </Box>

      {/* ── Vignette overlay for depth ── */}
      <Box
        position="absolute"
        inset={0}
        bg="radial-gradient(ellipse at center, transparent 40%, rgba(18,16,14,0.6) 100%)"
        zIndex={6}
        pointerEvents="none"
      />
    </Box>
  );
};
