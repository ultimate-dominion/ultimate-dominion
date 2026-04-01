import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { GiCrossedSwords } from 'react-icons/gi';
import SafeTypist from './SafeTypist';

import { type Character } from '../utils/types';
import { LevelingPanel } from './LevelingPanel';
import { ShareButton } from './ShareButton';

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

const badgePulse = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(106, 138, 176, 0.3), 0 0 40px rgba(106, 138, 176, 0.1), inset 0 0 15px rgba(106, 138, 176, 0.05); }
  50%      { box-shadow: 0 0 30px rgba(106, 138, 176, 0.5), 0 0 60px rgba(106, 138, 176, 0.2), inset 0 0 20px rgba(106, 138, 176, 0.1); }
`;

const spellPulse = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(160, 120, 220, 0.3), 0 0 40px rgba(160, 120, 220, 0.1), inset 0 0 15px rgba(160, 120, 220, 0.05); }
  50%      { box-shadow: 0 0 30px rgba(160, 120, 220, 0.5), 0 0 60px rgba(160, 120, 220, 0.2), inset 0 0 20px rgba(160, 120, 220, 0.1); }
`;

const badgeReveal = keyframes`
  from { opacity: 0; transform: scale(0.6) rotate(-10deg); }
  40%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
  70%  { transform: scale(0.97) rotate(-1deg); }
  to   { opacity: 1; transform: scale(1) rotate(0deg); }
`;

const gateDissolve = keyframes`
  0%   { opacity: 1; clip-path: inset(0 0 0 0); }
  40%  { opacity: 0.8; clip-path: inset(5% 3% 5% 3%); }
  70%  { opacity: 0.4; clip-path: inset(15% 10% 15% 10%); filter: blur(2px); }
  100% { opacity: 0; clip-path: inset(40% 30% 40% 30%); filter: blur(6px); }
`;

const stoneCrack = keyframes`
  0%   { width: 0; opacity: 0; }
  30%  { width: 40%; opacity: 0.6; }
  60%  { width: 70%; opacity: 0.9; }
  100% { width: 90%; opacity: 1; }
`;

const lightSeep = keyframes`
  0%   { opacity: 0; height: 0; }
  40%  { opacity: 0.3; height: 20px; }
  100% { opacity: 0.6; height: 40px; }
`;

/* ──────────────────────── Level Background Art ──────────────────────── */

const LEVEL_BACKGROUNDS: Record<number, string> = {
  2: '/images/levelup/level-2.png',
  3: '/images/levelup/level-3.png',
  4: '/images/levelup/level-4.png',
  5: '/images/levelup/level-5.png',
  6: '/images/levelup/level-6.png',
  7: '/images/levelup/level-7.png',
  8: '/images/levelup/level-8.png',
  9: '/images/levelup/level-9.png',
  10: '/images/levelup/level-10.png',
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
  const { t } = useTranslation('ui');
  const { t: tn } = useTranslation('narrative');
  const [phase, setPhase] = useState<'celebrate' | 'allocate' | 'narrative'>('celebrate');
  const [showContent, setShowContent] = useState(false);
  // Capture target level when modal opens — character.level updates after TX
  // but we need the level they're reaching, not the post-refresh level
  const [targetLevel, setTargetLevel] = useState(0);

  const levelKey = tn(`levelUp.${targetLevel}.title`, { defaultValue: '' }) ? `${targetLevel}` : 'default';
  const narrative = {
    title: tn(`levelUp.${levelKey}.title`),
    text: tn(`levelUp.${levelKey}.text`),
  };
  const backgroundImage = LEVEL_BACKGROUNDS[targetLevel];

  useEffect(() => {
    if (isOpen) {
      setPhase('celebrate');
      setShowContent(false);
      setTargetLevel(Number(character.level) + 1);
      const t = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(t);
    }
    setShowContent(false);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  {t('levelUp.youHaveReached')}
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
                  {t('level.label', { level: targetLevel })}
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
                {t('levelUp.abilityPoint')}
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

          {/* ── Phase 3: Narrative / Milestone ── */}
          {phase === 'narrative' && targetLevel === 3 && (
            /* ── Level 3: Adventurer Badge ── */
            <VStack
              spacing={6}
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 10 }}
              align="center"
            >
              {/* Badge emblem — matches character page badge style */}
              <Box
                w="100px"
                h="100px"
                borderRadius="16px"
                border="2px solid rgba(106, 138, 176, 0.4)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                position="relative"
                bg="rgba(106, 138, 176, 0.08)"
                animation={`${badgeReveal} 1s cubic-bezier(0.16, 1, 0.3, 1) forwards, ${badgePulse} 3s ease-in-out 1s infinite`}
                opacity={0}
              >
                <Box
                  position="absolute"
                  inset={0}
                  borderRadius="16px"
                  bg="radial-gradient(circle, rgba(106, 138, 176, 0.15) 0%, transparent 70%)"
                />
                <Box color="#6A8AB0" zIndex={1} filter="drop-shadow(0 0 12px rgba(106, 138, 176, 0.5))">
                  <GiCrossedSwords size={48} />
                </Box>
              </Box>

              {/* Title */}
              <Text
                fontFamily="'Cinzel', serif"
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight={700}
                color="#6A8AB0"
                letterSpacing="0.15em"
                textTransform="uppercase"
                textShadow="0 0 20px rgba(106, 138, 176, 0.3)"
                animation={`${fadeUp} 0.6s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both`}
              >
                {tn('milestone.3.title')}
              </Text>

              <Box mx="auto" w="60px" h="1px" bg="rgba(106, 138, 176, 0.3)" />

              {/* Badge narrative */}
              <Box
                maxW="420px"
                bg="rgba(28, 24, 20, 0.85)"
                borderRadius="md"
                border="1px solid rgba(106, 138, 176, 0.1)"
                px={{ base: 5, md: 7 }}
                py={6}
                animation={`${fadeUp} 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1) both`}
                position="relative"
              >
                <Text
                  fontSize={{ base: 'sm', md: 'md' }}
                  lineHeight="1.85"
                  visibility="hidden"
                  aria-hidden="true"
                  whiteSpace="pre-line"
                >
                  {tn('milestone.3.text')}
                </Text>
                <Box position="absolute" top={0} left={0} right={0} px={{ base: 5, md: 7 }} py={6}>
                  <SafeTypist
                    avgTypingDelay={50}
                    cursor={{ show: false }}
                    stdTypingDelay={25}
                    startDelay={1200}
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
                      {tn('milestone.3.text')}
                    </Text>
                  </SafeTypist>
                </Box>
              </Box>
            </VStack>
          )}

          {phase === 'narrative' && targetLevel === 5 && (
            /* ── Level 5: The Winding Dark Unlock ── */
            <VStack
              spacing={6}
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 10 }}
              align="center"
            >
              {/* Gate dissolving visual */}
              <Box position="relative" w="200px" h="60px">
                <Box
                  position="absolute"
                  inset={0}
                  border="2px solid rgba(212, 165, 74, 0.4)"
                  borderRadius="sm"
                  bg="linear-gradient(180deg, rgba(212, 165, 74, 0.08) 0%, rgba(212, 165, 74, 0.02) 100%)"
                  animation={`${gateDissolve} 2s 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards`}
                />
                <Box
                  position="absolute"
                  inset={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  opacity={0}
                  animation={`${fadeUp} 0.8s 2s cubic-bezier(0.16, 1, 0.3, 1) both`}
                >
                  <Text
                    fontFamily="'Cinzel', serif"
                    fontSize="xs"
                    letterSpacing="0.2em"
                    textTransform="uppercase"
                    color="rgba(212, 165, 74, 0.5)"
                  >
                    {tn('milestone.5.gate')}
                  </Text>
                </Box>
              </Box>

              {/* Title */}
              <Text
                fontFamily="'Cinzel', serif"
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight={700}
                color="#D4A54A"
                letterSpacing="0.1em"
                textShadow="0 0 20px rgba(212, 165, 74, 0.3)"
                animation={`${fadeUp} 0.6s 2.2s cubic-bezier(0.16, 1, 0.3, 1) both`}
              >
                {tn('milestone.5.title')}
              </Text>

              <Box mx="auto" w="60px" h="1px" bg="rgba(212, 165, 74, 0.3)" />

              {/* Narrative */}
              <Box
                maxW="420px"
                bg="rgba(28, 24, 20, 0.85)"
                borderRadius="md"
                border="1px solid rgba(196, 184, 158, 0.06)"
                px={{ base: 5, md: 7 }}
                py={6}
                animation={`${fadeUp} 0.6s 2.5s cubic-bezier(0.16, 1, 0.3, 1) both`}
                position="relative"
              >
                <Text
                  fontSize={{ base: 'sm', md: 'md' }}
                  lineHeight="1.85"
                  visibility="hidden"
                  aria-hidden="true"
                  whiteSpace="pre-line"
                >
                  {tn('milestone.5.text')}
                </Text>
                <Box position="absolute" top={0} left={0} right={0} px={{ base: 5, md: 7 }} py={6}>
                  <SafeTypist
                    avgTypingDelay={50}
                    cursor={{ show: false }}
                    stdTypingDelay={25}
                    startDelay={3000}
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
                      {tn('milestone.5.text')}
                    </Text>
                  </SafeTypist>
                </Box>
              </Box>
            </VStack>
          )}

          {phase === 'narrative' && targetLevel === 10 && (
            /* ── Level 10: Mastery / Class Selection Tease ── */
            <VStack
              spacing={6}
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 10 }}
              align="center"
            >
              {/* Cracked stone with light seeping through */}
              <Box position="relative" w="200px" h="80px" overflow="hidden">
                {/* Stone slab */}
                <Box
                  position="absolute"
                  inset={0}
                  border="2px solid rgba(180, 198, 212, 0.3)"
                  borderRadius="sm"
                  bg="linear-gradient(180deg, rgba(60, 55, 48, 0.6) 0%, rgba(40, 36, 30, 0.8) 100%)"
                />
                {/* Horizontal crack */}
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  h="2px"
                  bg="rgba(180, 198, 212, 0.8)"
                  boxShadow="0 0 12px rgba(180, 198, 212, 0.6), 0 0 24px rgba(180, 198, 212, 0.3)"
                  borderRadius="full"
                  animation={`${stoneCrack} 2s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
                  w="0"
                  opacity={0}
                />
                {/* Light seeping through crack */}
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translateX(-50%)"
                  w="60%"
                  bg="linear-gradient(180deg, rgba(180, 198, 212, 0.3) 0%, transparent 100%)"
                  animation={`${lightSeep} 2s 1s ease-out forwards`}
                  opacity={0}
                  h="0"
                />
              </Box>

              {/* Title */}
              <Text
                fontFamily="'Cinzel', serif"
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight={700}
                color="#B4C6D4"
                letterSpacing="0.1em"
                textShadow="0 0 20px rgba(180, 198, 212, 0.3)"
                animation={`${fadeUp} 0.6s 2s cubic-bezier(0.16, 1, 0.3, 1) both`}
              >
                {narrative.title}
              </Text>

              <Box mx="auto" w="60px" h="1px" bg="rgba(180, 198, 212, 0.3)" />

              {/* Narrative */}
              <Box
                maxW="420px"
                bg="rgba(28, 24, 20, 0.85)"
                borderRadius="md"
                border="1px solid rgba(180, 198, 212, 0.08)"
                px={{ base: 5, md: 7 }}
                py={6}
                animation={`${fadeUp} 0.6s 2.3s cubic-bezier(0.16, 1, 0.3, 1) both`}
                position="relative"
              >
                <Text
                  fontSize={{ base: 'sm', md: 'md' }}
                  lineHeight="1.85"
                  visibility="hidden"
                  aria-hidden="true"
                  whiteSpace="pre-line"
                >
                  {narrative.text}
                </Text>
                <Box position="absolute" top={0} left={0} right={0} px={{ base: 5, md: 7 }} py={6}>
                  <SafeTypist
                    avgTypingDelay={50}
                    cursor={{ show: false }}
                    stdTypingDelay={25}
                    startDelay={2600}
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
              </Box>
            </VStack>
          )}

          {phase === 'narrative' && targetLevel === 15 && (
            /* ── Level 15: Spell Acquisition ── */
            <VStack
              spacing={6}
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 10 }}
              align="center"
            >
              <Box
                w="80px"
                h="80px"
                borderRadius="full"
                border="2px solid rgba(160, 120, 220, 0.4)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="rgba(160, 120, 220, 0.08)"
                animation={`${badgeReveal} 1s cubic-bezier(0.16, 1, 0.3, 1) forwards, ${spellPulse} 3s ease-in-out 1s infinite`}
                opacity={0}
              >
                <Text fontSize="3xl" filter="drop-shadow(0 0 12px rgba(160, 120, 220, 0.5))">
                  ✦
                </Text>
              </Box>

              <Text
                fontFamily="'Cinzel', serif"
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight={700}
                color="#A078DC"
                letterSpacing="0.1em"
                textShadow="0 0 20px rgba(160, 120, 220, 0.3)"
                animation={`${fadeUp} 0.6s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both`}
              >
                {narrative.title}
              </Text>

              <Box mx="auto" w="60px" h="1px" bg="rgba(160, 120, 220, 0.3)" />

              <Box
                maxW="420px"
                bg="rgba(28, 24, 20, 0.85)"
                borderRadius="md"
                border="1px solid rgba(160, 120, 220, 0.08)"
                px={{ base: 5, md: 7 }}
                py={6}
                animation={`${fadeUp} 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1) both`}
                position="relative"
              >
                <Text
                  fontSize={{ base: 'sm', md: 'md' }}
                  lineHeight="1.85"
                  visibility="hidden"
                  aria-hidden="true"
                  whiteSpace="pre-line"
                >
                  {narrative.text}
                </Text>
                <Box position="absolute" top={0} left={0} right={0} px={{ base: 5, md: 7 }} py={6}>
                  <SafeTypist
                    avgTypingDelay={50}
                    cursor={{ show: false }}
                    stdTypingDelay={25}
                    startDelay={1200}
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
              </Box>
            </VStack>
          )}

          {phase === 'narrative' && targetLevel !== 3 && targetLevel !== 5 && targetLevel !== 10 && targetLevel !== 15 && (
            /* ── Generic narrative for other levels ── */
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
                position="relative"
              >
                <Text
                  fontSize={{ base: 'sm', md: 'md' }}
                  lineHeight="1.85"
                  visibility="hidden"
                  aria-hidden="true"
                  whiteSpace="pre-line"
                >
                  {narrative.text}
                </Text>
                <Box position="absolute" top={0} left={0} right={0} px={{ base: 5, md: 7 }} py={6}>
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
              {t('levelUp.allocateStats')}
            </Button>
          )}
          {phase === 'narrative' && (
            <VStack spacing={3}>
              <Button
                onClick={onClose}
                variant="gold"
                size="md"
              >
                {t('common.continue')}
              </Button>
              <ShareButton
                text={t('levelUp.shareText', { level: targetLevel })}
                shareParams={{
                  type: 'levelup',
                  level: targetLevel.toString(),
                  player: character.name,
                }}
                imageSrc={backgroundImage}
                colorAccent="#D4A54A"
              />
            </VStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
