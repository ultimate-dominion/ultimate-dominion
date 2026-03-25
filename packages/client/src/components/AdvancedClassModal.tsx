import {
  Box,
  Button,
  Grid,
  HStack,
  Image,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { ShareButton } from './ShareButton';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
import { CLASS_PAGE_PATH } from '../Routes';
import { getClassImage } from '../utils/classImages';
import { AdvancedClass, ADVANCED_CLASS_NAMES } from '../utils/types';

/* ──────────────────────── Class Colors ──────────────────────── */

const CLASS_COLORS: Record<AdvancedClass, string> = {
  [AdvancedClass.None]: '#8A7E6A',
  [AdvancedClass.Warrior]: '#C87A2A',
  [AdvancedClass.Paladin]: '#D4A54A',
  [AdvancedClass.Ranger]: '#5A8A3E',
  [AdvancedClass.Rogue]: '#7A7268',
  [AdvancedClass.Druid]: '#6B8A5A',
  [AdvancedClass.Warlock]: '#8B5AB5',
  [AdvancedClass.Wizard]: '#4A7FC5',
  [AdvancedClass.Cleric]: '#A8B8CC',
  [AdvancedClass.Sorcerer]: '#C84A3A',
};

/* ──────────────────────── Class Info ──────────────────────── */

const ADVANCED_CLASS_INFO: Record<AdvancedClass, {
  name: string;
  description: string;
  icon: string;
  flatBonuses: string;
  multipliers: string;
  spell: string;
  fantasy: string;
}> = {
  [AdvancedClass.None]: { name: 'None', description: '', icon: '', flatBonuses: '', multipliers: '', spell: '', fantasy: '' },
  [AdvancedClass.Warrior]: {
    name: 'Warrior',
    description: 'Pure martial masters who excel in physical combat.',
    icon: '\u2694\uFE0F',
    flatBonuses: '+3 STR, +10 HP',
    multipliers: '+10% Physical Damage',
    spell: 'Battle Cry: +4 STR, +3 Armor for 3 turns',
    fantasy: 'Iron will, unbreaking.',
  },
  [AdvancedClass.Paladin]: {
    name: 'Paladin',
    description: 'Holy warriors who combine strength with divine protection.',
    icon: '\uD83D\uDEE1\uFE0F',
    flatBonuses: '+2 STR, +15 HP',
    multipliers: '+5% Physical, +5% Healing Received',
    spell: 'Divine Shield: +5 Armor, +3 STR for 3 turns',
    fantasy: 'The light endures.',
  },
  [AdvancedClass.Ranger]: {
    name: 'Ranger',
    description: 'Swift combatants who excel at ranged attacks.',
    icon: '\uD83C\uDFF9',
    flatBonuses: '+3 AGI',
    multipliers: '+10% Physical Damage',
    spell: "Hunter's Mark: -5 AGI, -2 Armor on enemy for 4 turns",
    fantasy: 'One shot. One silence.',
  },
  [AdvancedClass.Rogue]: {
    name: 'Rogue',
    description: 'Cunning strikers who deal devastating critical hits.',
    icon: '\uD83D\uDDE1\uFE0F',
    flatBonuses: '+2 AGI, +1 INT',
    multipliers: '+15% Critical Damage',
    spell: 'Shadowstep: +8 AGI for 2 turns',
    fantasy: 'You never see the blade.',
  },
  [AdvancedClass.Druid]: {
    name: 'Druid',
    description: 'Versatile hybrids balancing physical and magical power.',
    icon: '\uD83C\uDF3F',
    flatBonuses: '+2 AGI, +2 STR',
    multipliers: '+5% All Damage, +5% Max HP',
    spell: 'Entangle: -5 AGI, -3 STR on enemy for 3 turns',
    fantasy: 'The earth remembers.',
  },
  [AdvancedClass.Warlock]: {
    name: 'Warlock',
    description: 'Dark casters who specialize in sustained damage.',
    icon: '\uD83D\uDD2E',
    flatBonuses: '+2 AGI, +2 INT',
    multipliers: '+10% Spell Damage',
    spell: 'Soul Drain: 8-14 magic damage + -3 STR, -3 INT on enemy for 3 turns',
    fantasy: 'Power has a price. Others pay it.',
  },
  [AdvancedClass.Wizard]: {
    name: 'Wizard',
    description: 'Pure arcane masters with the highest spell damage.',
    icon: '\uD83D\uDCD6',
    flatBonuses: '+3 INT',
    multipliers: '+15% Spell Damage',
    spell: 'Arcane Blast: 12-20 magic damage',
    fantasy: 'Knowledge is annihilation.',
  },
  [AdvancedClass.Cleric]: {
    name: 'Cleric',
    description: 'Divine healers who support and protect allies.',
    icon: '\u2728',
    flatBonuses: '+2 INT, +10 HP',
    multipliers: '+10% Healing Done',
    spell: 'Blessing: +3 INT, +5 Armor, +5 Max HP for 3 turns',
    fantasy: 'They shall not fall.',
  },
  [AdvancedClass.Sorcerer]: {
    name: 'Sorcerer',
    description: 'Battle mages who blend strength with arcane power.',
    icon: '\uD83D\uDCAA',
    flatBonuses: '+2 STR, +2 INT',
    multipliers: '+8% Spell Damage, +5% Max HP',
    spell: 'Arcane Surge: 10-16 magic damage',
    fantasy: 'Magic and muscle, fused.',
  },
};

const ALL_CLASSES: AdvancedClass[] = [
  AdvancedClass.Warrior,
  AdvancedClass.Paladin,
  AdvancedClass.Ranger,
  AdvancedClass.Rogue,
  AdvancedClass.Druid,
  AdvancedClass.Warlock,
  AdvancedClass.Wizard,
  AdvancedClass.Cleric,
  AdvancedClass.Sorcerer,
];

/* ──────────────────────── Keyframes ──────────────────────── */

const overlayEnter = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const titleReveal = keyframes`
  from { opacity: 0; transform: translateY(-20px); letter-spacing: 0.4em; }
  60%  { opacity: 1; transform: translateY(2px); letter-spacing: 0.18em; }
  to   { opacity: 1; transform: translateY(0); letter-spacing: 0.2em; }
`;

const subtitleFade = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const cardEnter = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const shimmerLine = keyframes`
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
`;

const classGlow = keyframes`
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
`;

const transformBurst = keyframes`
  0%   { opacity: 0; transform: scale(0.3); }
  40%  { opacity: 0.9; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(2.5); }
`;

const portraitReveal = keyframes`
  0%   { opacity: 0; transform: scale(0.7); filter: blur(8px) brightness(2); }
  50%  { opacity: 1; transform: scale(1.05); filter: blur(0) brightness(1.3); }
  100% { opacity: 1; transform: scale(1); filter: blur(0) brightness(1); }
`;

const nameReveal = keyframes`
  from { opacity: 0; transform: translateY(20px); letter-spacing: 0.4em; }
  60%  { opacity: 1; letter-spacing: 0.22em; }
  to   { opacity: 1; transform: translateY(0); letter-spacing: 0.2em; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const exitFade = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; }
`;

const pulseGlow = keyframes`
  0%, 100% { text-shadow: 0 0 20px currentColor; }
  50%      { text-shadow: 0 0 40px currentColor, 0 0 80px currentColor; }
`;

const detailSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ──────────────────────── Component ──────────────────────── */

type AdvancedClassModalProps = {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  onClassSelected: () => void;
};

export const AdvancedClassModal = ({
  isOpen,
  onClose,
  characterId,
  onClassSelected,
}: AdvancedClassModalProps): JSX.Element | null => {
  const {
    systemCalls: { selectAdvancedClass },
  } = useMUD();

  const selectClassTx = useTransaction({ actionName: 'select class', showSuccessToast: false });
  const [selectedClass, setSelectedClass] = useState<AdvancedClass | null>(null);
  const [confirmedClass, setConfirmedClass] = useState<AdvancedClass | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // Stagger grid entrance
  useEffect(() => {
    if (isOpen) {
      setShowGrid(false);
      setSelectedClass(null);
      setConfirmedClass(null);
      setIsExiting(false);
      const timer = setTimeout(() => setShowGrid(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key to dismiss (only during selection, not after transform)
  useEffect(() => {
    if (!isOpen || confirmedClass) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, confirmedClass, onClose]);

  const onConfirmClass = useCallback(async () => {
    if (!selectedClass) return;

    const result = await selectClassTx.execute(async () => {
      const { error, success } = await selectAdvancedClass(characterId, selectedClass);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      onClassSelected();
      setConfirmedClass(selectedClass);
      import('../utils/analytics').then(({ trackAdvancedClassSelected }) =>
        trackAdvancedClassSelected(ADVANCED_CLASS_NAMES[selectedClass] ?? 'Unknown'),
      );
    }
  }, [characterId, selectedClass, onClassSelected, selectAdvancedClass, selectClassTx]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setConfirmedClass(null);
      setSelectedClass(null);
      setIsExiting(false);
      onClose();
    }, 600);
  }, [onClose]);

  if (!isOpen) return null;

  const selectedInfo = selectedClass ? ADVANCED_CLASS_INFO[selectedClass] : null;
  const selectedColor = selectedClass ? CLASS_COLORS[selectedClass] : '#D4A54A';
  const confirmedInfo = confirmedClass ? ADVANCED_CLASS_INFO[confirmedClass] : null;
  const confirmedColor = confirmedClass ? CLASS_COLORS[confirmedClass] : '#D4A54A';

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="#12100E"
      zIndex={9999}
      overflow="auto"
      animation={isExiting ? `${exitFade} 0.6s ease-out forwards` : `${overlayEnter} 0.4s ease-out`}
    >
      {/* Background atmosphere */}
      <Box
        position="fixed"
        inset={0}
        bg="radial-gradient(ellipse at 50% 20%, rgba(200,122,42,0.06) 0%, transparent 60%)"
        pointerEvents="none"
      />

      {/* ── SELECTION VIEW ── */}
      {!confirmedClass && (
        <Box
          maxW="900px"
          mx="auto"
          px={{ base: 4, md: 8 }}
          py={{ base: 8, md: 12 }}
          position="relative"
        >
          {/* Dismiss */}
          <Box position="absolute" top={{ base: 2, md: 4 }} right={{ base: 2, md: 4 }}>
            <Button
              variant="unstyled"
              color="#8A7E6A"
              fontSize="xs"
              fontFamily="'Cinzel', serif"
              letterSpacing="0.05em"
              _hover={{ color: '#C4B89E' }}
              onClick={onClose}
              opacity={0}
              animation={`${subtitleFade} 0.4s 2s ease-out forwards`}
            >
              Not now
            </Button>
          </Box>

          {/* Title */}
          <Text
            textAlign="center"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '2xl', md: '4xl' }}
            fontWeight={700}
            color="#D4A54A"
            letterSpacing="0.2em"
            textTransform="uppercase"
            opacity={0}
            animation={`${titleReveal} 1s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
          >
            Choose Your Path
          </Text>

          {/* Shimmer divider */}
          <Box
            mx="auto"
            mt={4}
            mb={2}
            w="160px"
            h="1px"
            background="linear-gradient(90deg, transparent, #D4A54A, transparent)"
            backgroundSize="200% 100%"
            opacity={0}
            animation={`${subtitleFade} 0.6s 0.8s ease-out forwards, ${shimmerLine} 4s 1.2s ease-in-out infinite`}
          />

          {/* Subtitle */}
          <Text
            textAlign="center"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: 'xs', md: 'sm' }}
            fontStyle="italic"
            color="#8A7E6A"
            mb={{ base: 8, md: 12 }}
            opacity={0}
            animation={`${subtitleFade} 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
          >
            This decision is permanent. Choose wisely.
          </Text>

          {/* Class Grid */}
          <Grid
            templateColumns={{ base: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' }}
            gap={{ base: 2, md: 4 }}
          >
            {ALL_CLASSES.map((advClass, index) => {
              const info = ADVANCED_CLASS_INFO[advClass];
              const color = CLASS_COLORS[advClass];
              const isSelected = selectedClass === advClass;
              const isDimmed = selectedClass !== null && !isSelected;
              const image = getClassImage(info.name);

              return (
                <Box
                  key={advClass}
                  position="relative"
                  cursor="pointer"
                  onClick={() => setSelectedClass(advClass)}
                  opacity={showGrid ? 1 : 0}
                  animation={showGrid ? `${cardEnter} 0.6s ${0.05 * index}s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
                  transition="all 0.3s ease"
                  transform={isSelected ? 'scale(1.03)' : isDimmed ? 'scale(0.97)' : 'scale(1)'}
                  filter={isDimmed ? 'brightness(0.5)' : 'brightness(1)'}
                  _hover={!isDimmed ? {
                    transform: isSelected ? 'scale(1.03)' : 'scale(1.02)',
                    '& .class-glow': { opacity: 0.8 },
                  } : undefined}
                >
                  {/* Color glow behind card */}
                  <Box
                    className="class-glow"
                    position="absolute"
                    inset="-2px"
                    borderRadius="12px"
                    bg={`radial-gradient(ellipse at center, ${color}40 0%, transparent 70%)`}
                    opacity={isSelected ? 0.9 : 0.3}
                    transition="opacity 0.3s ease"
                    animation={isSelected ? `${classGlow} 2.5s ease-in-out infinite` : undefined}
                    pointerEvents="none"
                  />

                  {/* Card */}
                  <Box
                    position="relative"
                    bg="#1C1814"
                    border="1px solid"
                    borderColor={isSelected ? color : '#3A3228'}
                    borderRadius="10px"
                    overflow="hidden"
                    transition="border-color 0.3s ease"
                    boxShadow={isSelected ? `0 0 20px ${color}30, 0 0 40px ${color}15` : '0 4px 12px rgba(0,0,0,0.4)'}
                  >
                    {/* Portrait */}
                    {image && (
                      <Box
                        position="relative"
                        w="100%"
                        aspectRatio="1/1"
                        overflow="hidden"
                      >
                        <Image
                          src={image}
                          alt={info.name}
                          w="100%"
                          h="100%"
                          objectFit="cover"
                          filter={isSelected ? 'saturate(1.1) brightness(1.05)' : 'saturate(0.8) brightness(0.85)'}
                          transition="filter 0.3s ease"
                        />
                        {/* Bottom gradient for text readability */}
                        <Box
                          position="absolute"
                          bottom={0}
                          left={0}
                          right={0}
                          h="50%"
                          bg="linear-gradient(transparent, rgba(18,16,14,0.95))"
                        />
                        {/* Class name overlay */}
                        <Box
                          position="absolute"
                          bottom={0}
                          left={0}
                          right={0}
                          p={{ base: 2, md: 3 }}
                          textAlign="center"
                        >
                          <Text
                            fontFamily="'Cinzel', serif"
                            fontSize={{ base: 'xs', md: 'md' }}
                            fontWeight={700}
                            color={isSelected ? color : '#E8DCC8'}
                            letterSpacing="0.1em"
                            textTransform="uppercase"
                            transition="color 0.3s ease"
                            textShadow={isSelected ? `0 0 12px ${color}60` : '0 1px 3px rgba(0,0,0,0.5)'}
                          >
                            {info.name}
                          </Text>
                          <Text
                            fontFamily="'Cormorant Garamond', serif"
                            fontSize={{ base: '2xs', md: 'xs' }}
                            fontStyle="italic"
                            color="#8A7E6A"
                            mt={0.5}
                            display={{ base: 'none', md: 'block' }}
                          >
                            {info.fantasy}
                          </Text>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Grid>

          {/* ── Detail Panel (shows when class selected) ── */}
          {selectedInfo && (
            <Box
              key={selectedClass}
              mt={{ base: 6, md: 8 }}
              bg="rgba(28, 24, 20, 0.9)"
              border="1px solid"
              borderColor={`${selectedColor}40`}
              borderRadius="12px"
              p={{ base: 5, md: 8 }}
              position="relative"
              overflow="hidden"
              animation={`${detailSlide} 0.4s cubic-bezier(0.16, 1, 0.3, 1)`}
            >
              {/* Accent glow in corner */}
              <Box
                position="absolute"
                top={0}
                left={0}
                w="200px"
                h="200px"
                bg={`radial-gradient(circle at 0% 0%, ${selectedColor}15 0%, transparent 70%)`}
                pointerEvents="none"
              />

              <VStack spacing={4} align="stretch" position="relative">
                {/* Class name + description */}
                <Box>
                  <HStack spacing={3} mb={2}>
                    <Text
                      fontFamily="'Cinzel', serif"
                      fontSize={{ base: 'lg', md: 'xl' }}
                      fontWeight={700}
                      color={selectedColor}
                      letterSpacing="0.08em"
                    >
                      {selectedInfo.name}
                    </Text>
                    <Link
                      as={RouterLink}
                      to={`${CLASS_PAGE_PATH}/${selectedInfo.name.toLowerCase()}`}
                      fontSize="xs"
                      color="#8A7E6A"
                      _hover={{ color: selectedColor, textDecoration: 'underline' }}
                    >
                      Learn more
                    </Link>
                  </HStack>
                  <Text
                    fontSize={{ base: 'sm', md: 'md' }}
                    color="#C4B89E"
                    lineHeight="1.6"
                  >
                    {selectedInfo.description}
                  </Text>
                </Box>

                {/* Stats row */}
                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={3}>
                  <Box
                    bg="#14120F"
                    borderRadius="8px"
                    p={3}
                    border="1px solid #3A3228"
                  >
                    <Text fontSize="2xs" color="#8A7E6A" textTransform="uppercase" letterSpacing="0.1em" mb={1}>
                      Bonuses
                    </Text>
                    <Text fontSize="sm" color="#5A8A3E" fontWeight={600} fontFamily="mono">
                      {selectedInfo.flatBonuses}
                    </Text>
                  </Box>
                  <Box
                    bg="#14120F"
                    borderRadius="8px"
                    p={3}
                    border="1px solid #3A3228"
                  >
                    <Text fontSize="2xs" color="#8A7E6A" textTransform="uppercase" letterSpacing="0.1em" mb={1}>
                      Multipliers
                    </Text>
                    <Text fontSize="sm" color="#D4A54A" fontWeight={600} fontFamily="mono">
                      {selectedInfo.multipliers}
                    </Text>
                  </Box>
                  <Box
                    bg="#14120F"
                    borderRadius="8px"
                    p={3}
                    border="1px solid #3A3228"
                  >
                    <Text fontSize="2xs" color="#8A7E6A" textTransform="uppercase" letterSpacing="0.1em" mb={1}>
                      Class Spell
                    </Text>
                    <Text fontSize="sm" color="#4A9FC5" fontWeight={600} fontFamily="mono">
                      {selectedInfo.spell}
                    </Text>
                  </Box>
                </Grid>

                {/* Confirm button */}
                <Button
                  onClick={onConfirmClass}
                  isLoading={selectClassTx.isLoading}
                  loadingText="Becoming..."
                  variant="gold"
                  size="md"
                  w="100%"
                  mt={2}
                  fontFamily="'Cinzel', serif"
                  letterSpacing="0.08em"
                  textTransform="uppercase"
                  fontSize="sm"
                >
                  Become a {selectedInfo.name}
                </Button>
              </VStack>
            </Box>
          )}
        </Box>
      )}

      {/* ── TRANSFORMATION VIEW ── */}
      {confirmedInfo && (
        <Box
          position="fixed"
          inset={0}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={6}
          px={6}
        >
          {/* Color burst ring */}
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="400px"
            h="400px"
            borderRadius="50%"
            border={`2px solid ${confirmedColor}`}
            opacity={0}
            animation={`${transformBurst} 1.5s 0.2s ease-out forwards`}
            pointerEvents="none"
          />
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="300px"
            h="300px"
            borderRadius="50%"
            bg={`radial-gradient(circle, ${confirmedColor}30 0%, transparent 70%)`}
            opacity={0}
            animation={`${transformBurst} 2s 0.4s ease-out forwards`}
            pointerEvents="none"
          />

          {/* Background radial glow */}
          <Box
            position="absolute"
            inset={0}
            bg={`radial-gradient(ellipse at 50% 40%, ${confirmedColor}12 0%, transparent 50%)`}
            opacity={0}
            animation={`${subtitleFade} 1.5s 0.5s ease-out forwards`}
            pointerEvents="none"
          />

          {/* Class portrait */}
          {getClassImage(confirmedInfo.name) && (
            <Box
              position="relative"
              w={{ base: '140px', md: '180px' }}
              h={{ base: '140px', md: '180px' }}
              borderRadius="16px"
              overflow="hidden"
              border={`2px solid ${confirmedColor}`}
              boxShadow={`0 0 40px ${confirmedColor}40, 0 0 80px ${confirmedColor}20`}
              opacity={0}
              animation={`${portraitReveal} 1.2s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
            >
              <Image
                src={getClassImage(confirmedInfo.name)}
                alt={confirmedInfo.name}
                w="100%"
                h="100%"
                objectFit="cover"
              />
            </Box>
          )}

          {/* Class name */}
          <Text
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '2xl', md: '4xl' }}
            fontWeight={700}
            color={confirmedColor}
            letterSpacing="0.2em"
            textTransform="uppercase"
            opacity={0}
            animation={`${nameReveal} 1s 1s cubic-bezier(0.16, 1, 0.3, 1) forwards, ${pulseGlow} 3s 2s ease-in-out infinite`}
          >
            {confirmedInfo.name}
          </Text>

          {/* Divider */}
          <Box
            w="80px"
            h="1px"
            bg={`linear-gradient(90deg, transparent, ${confirmedColor}, transparent)`}
            opacity={0}
            animation={`${subtitleFade} 0.6s 1.5s ease-out forwards`}
          />

          {/* Narrative */}
          <Text
            fontFamily="'Cormorant Garamond', serif"
            fontSize={{ base: 'md', md: 'lg' }}
            fontStyle="italic"
            color="#C4B89E"
            textAlign="center"
            maxW="400px"
            lineHeight="1.8"
            opacity={0}
            animation={`${fadeUp} 0.8s 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
            textShadow="0 1px 3px rgba(0,0,0,0.4)"
          >
            You have walked the Dark Cave and survived.{'\n'}
            Your path is chosen. The world will remember.
          </Text>

          {/* Actions */}
          <VStack spacing={3} opacity={0} animation={`${fadeUp} 0.6s 2.5s ease-out forwards`}>
            <Button
              onClick={handleClose}
              variant="gold"
              size="md"
              fontFamily="'Cinzel', serif"
              letterSpacing="0.08em"
              textTransform="uppercase"
              fontSize="sm"
            >
              Continue
            </Button>
            <ShareButton
              text={`Became a ${confirmedInfo.name} in Ultimate Dominion. Level 10 achieved.`}
              shareParams={{
                type: 'class',
                class: confirmedInfo.name,
              }}
              imageSrc={getClassImage(confirmedInfo.name)}
              colorAccent={confirmedColor}
            />
          </VStack>
        </Box>
      )}

      {/* Vignette */}
      <Box
        position="fixed"
        inset={0}
        bg="radial-gradient(ellipse at center, transparent 30%, rgba(18,16,14,0.5) 100%)"
        pointerEvents="none"
        zIndex={-1}
      />
    </Box>
  );
};
