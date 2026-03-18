import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  keyframes,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import SafeTypist from './SafeTypist';

import { type Character } from '../utils/types';
import { LevelingPanel } from './LevelingPanel';

/* ──────────────────────── Animations ──────────────────────── */

const levelReveal = keyframes`
  from { opacity: 0; transform: scale(0.85) translateY(20px); }
  60%  { opacity: 1; transform: scale(1.04) translateY(-4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const goldGlow = keyframes`
  0%, 100% { text-shadow: 0 0 12px rgba(212, 165, 74, 0.4), 0 0 30px rgba(212, 165, 74, 0.2); }
  50%      { text-shadow: 0 0 20px rgba(212, 165, 74, 0.7), 0 0 50px rgba(212, 165, 74, 0.3); }
`;

const shimmer = keyframes`
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
`;

/* ──────────────────────── Level Background Art ──────────────────────── */

const LEVEL_BACKGROUNDS: Record<number, string> = {
  2: '/images/levelup/level-2.png',
};

/* ──────────────────────── Level Narratives ──────────────────────── */

const LEVEL_NARRATIVES: Record<number, { title: string; text: string }> = {
  2: {
    title: 'The cave grows darker.',
    text: 'Something shifts in the gloom ahead \u2014 hunched shapes, larger than any rat, with eyes that gleam with a terrible intelligence.\n\nYou are not alone down here.',
  },
  3: {
    title: 'The depths stir.',
    text: 'New sounds echo from passages you haven\u2019t dared explore \u2014 scraping claws, crackling energy, the low hum of something ancient.\n\nThe cave\u2019s true inhabitants make themselves known.',
  },
  4: {
    title: 'The darkness knows your name.',
    text: 'You move through the cave with purpose now. The creatures that once seemed fearsome give you a wider berth.\n\nBut deeper things are watching \u2014 waiting to see if you are worthy.',
  },
  5: {
    title: 'Beyond the boundary.',
    text: 'The walls that once held you back crumble to dust at your touch. Beyond lies a realm where other adventurers hunt \u2014 and are hunted.\n\nThe line between predator and prey has never been thinner.',
  },
};

const DEFAULT_NARRATIVE = {
  title: 'You grow stronger.',
  text: 'The cave tests you with greater challenges.\n\nYou answer.',
};

/* ──────────────────────── Component ──────────────────────── */

type LevelUpModalProps = {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
};

export const LevelUpModal = ({
  character,
  isOpen,
  onClose,
}: LevelUpModalProps): JSX.Element => {
  const [phase, setPhase] = useState<'celebrate' | 'allocate' | 'narrative'>('celebrate');
  const [showContent, setShowContent] = useState(false);

  const nextLevel = Number(character.level) + 1;
  const narrative = LEVEL_NARRATIVES[nextLevel] ?? DEFAULT_NARRATIVE;
  const backgroundImage = LEVEL_BACKGROUNDS[nextLevel];

  useEffect(() => {
    if (isOpen) {
      setPhase('celebrate');
      setShowContent(false);
      const t = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(t);
    }
    setShowContent(false);
  }, [isOpen]);

  const handleProceedToAllocate = () => {
    setPhase('allocate');
  };

  const handleLevelComplete = () => {
    setPhase('narrative');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: 'full', md: 'xl' }}
      isCentered
      motionPreset="none"
      closeOnOverlayClick={false}
    >
      <ModalOverlay
        bg="blackAlpha.800"
        backdropFilter="blur(10px)"
        css={{
          animation: 'fadeOverlay 0.4s ease-out',
          '@keyframes fadeOverlay': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      />
      <ModalContent
        bg="#1C1814"
        color="#E8DCC8"
        borderRadius={{ base: 0, md: 'lg' }}
        border="1px solid rgba(212, 165, 74, 0.2)"
        boxShadow="0 0 80px 12px rgba(212, 165, 74, 0.1), 0 0 160px 30px rgba(212, 165, 74, 0.05)"
        maxH={{ base: '100dvh', md: '90vh' }}
        overflow="hidden"
        position="relative"
        css={{
          animation: 'modalEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes modalEnter': {
            from: { opacity: 0, transform: 'scale(0.92) translateY(20px)' },
            to: { opacity: 1, transform: 'scale(1) translateY(0)' },
          },
        }}
      >
        {/* Background art layer — one image, styled per phase */}
        {backgroundImage && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundImage={`url(${backgroundImage})`}
            backgroundSize="cover"
            backgroundPosition={phase === 'narrative' ? 'center bottom' : 'center'}
            backgroundRepeat="no-repeat"
            opacity={phase === 'allocate' ? 0.06 : phase === 'narrative' ? 0.25 : 0.15}
            filter={phase === 'allocate' ? 'blur(4px)' : 'none'}
            transition="opacity 0.6s ease, filter 0.6s ease, background-position 0.8s ease"
            pointerEvents="none"
          />
        )}
        {/* Radial gradient overlay for text readability — softer on narrative */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg={phase === 'narrative'
            ? 'radial-gradient(ellipse at center, rgba(28, 24, 20, 0.4) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(28, 24, 20, 0.7) 0%, transparent 70%)'}
          transition="background 0.6s ease"
          pointerEvents="none"
        />

        <ModalBody p={0} overflowY="auto" position="relative">
          {/* ── Phase 1: Celebration ── */}
          {phase === 'celebrate' && (
            <VStack
              spacing={6}
              py={{ base: 16, md: 20 }}
              px={8}
              opacity={showContent ? 1 : 0}
            >
              {/* Level number — big hero moment */}
              <Box
                animation={showContent ? `${levelReveal} 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards` : undefined}
                opacity={0}
              >
                <Text
                  textAlign="center"
                  fontSize="xs"
                  fontFamily="'Cinzel', serif"
                  letterSpacing="widest"
                  textTransform="uppercase"
                  color="rgba(212, 165, 74, 0.6)"
                  mb={2}
                >
                  You have reached
                </Text>
                <Text
                  textAlign="center"
                  fontSize={{ base: '5xl', md: '6xl' }}
                  fontWeight={700}
                  fontFamily="'Cinzel', serif"
                  color="#D4A54A"
                  lineHeight="1"
                  animation={`${goldGlow} 3s ease-in-out infinite`}
                >
                  Level {nextLevel}
                </Text>
              </Box>

              {/* Divider shimmer */}
              <Box
                w="120px"
                h="2px"
                borderRadius="full"
                background="linear-gradient(90deg, transparent, #D4A54A, transparent)"
                backgroundSize="200% 100%"
                animation={showContent ? `${shimmer} 3s ease-in-out infinite` : undefined}
                opacity={showContent ? 1 : 0}
                css={{
                  animation: showContent
                    ? `${fadeUp} 0.6s 0.5s cubic-bezier(0.16, 1, 0.3, 1) both, ${shimmer} 3s ease-in-out infinite`
                    : undefined,
                }}
              />

              {/* Atmospheric text */}
              <Text
                textAlign="center"
                fontSize={{ base: 'sm', md: 'md' }}
                fontFamily="'Cinzel', serif"
                fontStyle="italic"
                color="#8A7E6A"
                maxW="360px"
                opacity={showContent ? 1 : 0}
                animation={showContent ? `${fadeUp} 0.6s 0.7s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
              >
                {narrative.title}
              </Text>

              {/* Stat point notification */}
              <Text
                textAlign="center"
                fontSize="sm"
                fontFamily="mono"
                color="#D4A54A"
                opacity={showContent ? 1 : 0}
                animation={showContent ? `${fadeUp} 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
              >
                +1 Ability Point
              </Text>
            </VStack>
          )}

          {/* ── Phase 2: Stat Allocation ── */}
          {phase === 'allocate' && (
            <VStack spacing={0} py={4}>
              <LevelingPanel
                canLevel
                character={character}
                compact
                onLevelComplete={handleLevelComplete}
              />
            </VStack>
          )}

          {/* ── Phase 3: Narrative Tease ── */}
          {phase === 'narrative' && (
            <VStack
              spacing={6}
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 10 }}
              align="center"
            >
              <Box mx="auto" w="60px" h="1px" bg="rgba(212, 165, 74, 0.3)" />

              <Box
                maxW="420px"
                bg="rgba(28, 24, 20, 0.85)"
                borderRadius="md"
                border="1px solid rgba(196, 184, 158, 0.06)"
                px={{ base: 5, md: 7 }}
                py={6}
              >
                <SafeTypist
                  avgTypingDelay={50}
                  cursor={{ show: false }}
                  stdTypingDelay={25}
                >
                  <Text
                    fontSize={{ base: 'sm', md: 'md' }}
                    lineHeight="1.85"
                    color="#D4C8B0"
                    fontStyle="italic"
                    textAlign="center"
                    whiteSpace="pre-line"
                    textShadow="0 1px 2px rgba(0, 0, 0, 0.3)"
                  >
                    {narrative.text}
                  </Text>
                </SafeTypist>
              </Box>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter justifyContent="center" pb={8} position="relative">
          {phase === 'celebrate' && (
            <Button
              onClick={handleProceedToAllocate}
              variant="gold"
              size="md"
              opacity={showContent ? 1 : 0}
              animation={showContent ? `${fadeUp} 0.6s 1.3s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
            >
              Allocate Stats
            </Button>
          )}
          {phase === 'narrative' && (
            <Button
              onClick={onClose}
              variant="gold"
              size="md"
            >
              Continue
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
