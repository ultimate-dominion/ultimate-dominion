import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Image,
  keyframes,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import SafeTypist from './SafeTypist';

import { useCharacter } from '../contexts/CharacterContext';
import { useFragments, type FragmentStatus } from '../contexts/FragmentContext';
import { getFragmentColor, getFragmentImage } from '../utils/fragmentImages';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

/* ──────────────────────── Animations ──────────────────────── */

const artReveal = keyframes`
  from { opacity: 0; transform: scale(1.04); }
  to   { opacity: 1; transform: scale(1); }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const glowPulse = (color: string) => keyframes`
  0%, 100% { box-shadow: 0 0 20px 4px ${color}30, 0 0 50px 8px ${color}15; }
  50%      { box-shadow: 0 0 30px 6px ${color}45, 0 0 70px 12px ${color}22; }
`;

const titleGlow = (color: string) => keyframes`
  0%, 100% { text-shadow: 0 0 8px ${color}40, 0 0 20px ${color}20; }
  50%      { text-shadow: 0 0 14px ${color}60, 0 0 30px ${color}30; }
`;

const xpFlash = keyframes`
  0%   { opacity: 0; transform: translateY(8px) scale(0.9); }
  40%  { opacity: 1; transform: translateY(-2px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

/* ──────────────────────── Component ──────────────────────── */

type FragmentClaimModalProps = {
  fragment: FragmentStatus;
  isOpen: boolean;
  onClose: () => void;
};

export const FragmentClaimModal = ({
  fragment,
  isOpen,
  onClose,
}: FragmentClaimModalProps): JSX.Element => {
  const { claimFragment, isClaiming, fragments } = useFragments();
  const { refreshCharacter } = useCharacter();
  const [isClaimed, setIsClaimed] = useState(false);
  const color = getFragmentColor(fragment.name);
  const imageSrc = getFragmentImage(fragment.name);
  const modalSize = useBreakpointValue({ base: 'full', md: '2xl' });

  // Stagger content reveal
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(t);
    }
    setShowContent(false);
    setIsClaimed(false);
  }, [isOpen]);

  const handleClaim = async () => {
    await claimFragment(fragment.fragmentType);
    setIsClaimed(true);
    refreshCharacter();
  };

  const handleClose = () => {
    setIsClaimed(false);
    onClose();
  };

  const claimedCount = isClaimed
    ? fragments.filter(f => f.claimed || f.fragmentType === fragment.fragmentType).length
    : fragments.filter(f => f.claimed).length;
  const isAllCollected = claimedCount >= TOTAL_FRAGMENTS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={modalSize}
      isCentered
      motionPreset="none"
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
        border="1px solid"
        borderColor={`${color}20`}
        boxShadow={`0 0 80px 12px ${color}15, 0 0 160px 30px ${color}08`}
        maxH={{ base: '100dvh', md: '90vh' }}
        overflow="hidden"
        css={{
          animation: 'modalEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes modalEnter': {
            from: { opacity: 0, transform: 'scale(0.92) translateY(20px)' },
            to: { opacity: 1, transform: 'scale(1) translateY(0)' },
          },
        }}
      >
        <ModalBody p={0} overflowY="auto"
          css={{
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: `${color}30`, borderRadius: '2px' },
          }}
        >
          <VStack spacing={0} align="stretch">
            {/* ── Hero image (pre-claim only) ── */}
            {!isClaimed && (
              imageSrc ? (
                <Box
                  position="relative"
                  opacity={showContent ? 1 : 0}
                  animation={showContent ? `${artReveal} 1s cubic-bezier(0.16, 1, 0.3, 1) forwards` : undefined}
                >
                  <Image
                    src={imageSrc}
                    alt={fragment.name}
                    w="100%"
                    maxH={{ base: '50vh', md: '420px' }}
                    objectFit="contain"
                    bg="#0A0908"
                  />
                  {/* Bottom fade */}
                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="100px"
                    bgGradient="linear(to-t, #1C1814, transparent)"
                  />
                  {/* Glowing edge */}
                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="2px"
                    bg={`${color}50`}
                    animation={`${glowPulse(color)} 4s ease-in-out infinite`}
                  />
                </Box>
              ) : (
                <Box
                  h={{ base: '30vh', md: '200px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={`${color}08`}
                  position="relative"
                  opacity={showContent ? 1 : 0}
                  animation={showContent ? `${artReveal} 0.8s ease-out forwards` : undefined}
                >
                  <Text
                    color={`${color}50`}
                    fontSize="sm"
                    fontFamily="'Cinzel', serif"
                    letterSpacing="widest"
                    textTransform="uppercase"
                  >
                    Fragment {getRomanNumeral(fragment.fragmentType)}
                  </Text>
                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="2px"
                    bg={`${color}50`}
                    animation={`${glowPulse(color)} 4s ease-in-out infinite`}
                  />
                </Box>
              )
            )}

            {/* ── Text content ── */}
            <VStack
              spacing={4}
              align="stretch"
              px={{ base: 5, md: 8 }}
              pt={isClaimed ? 8 : 4}
              pb={4}
              opacity={showContent ? 1 : 0}
              animation={showContent ? `${fadeUp} 0.6s 0.4s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
            >
              {/* Fragment number */}
              <Text
                textAlign="center"
                color={`${color}70`}
                fontSize="xs"
                fontFamily="'Cinzel', serif"
                letterSpacing="widest"
                textTransform="uppercase"
              >
                Fragment {getRomanNumeral(fragment.fragmentType)} of{' '}
                {getRomanNumeral(TOTAL_FRAGMENTS)}
              </Text>

              {/* Title */}
              <Text
                textAlign="center"
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight={700}
                fontFamily="'Cinzel', serif"
                color={color}
                animation={`${titleGlow(color)} 4s ease-in-out infinite`}
                lineHeight="shorter"
              >
                {fragment.name}
              </Text>

              {isClaimed ? (
                <>
                  {/* XP reward */}
                  <Text
                    textAlign="center"
                    fontSize="lg"
                    fontWeight={700}
                    fontFamily="mono"
                    color={color}
                    animation={`${xpFlash} 0.5s ease-out`}
                  >
                    +1 XP
                  </Text>

                  {/* Divider */}
                  <Box mx="auto" w="60px" h="1px" bg={`${color}30`} />

                  {/* Narrative with typewriter */}
                  <Box
                    px={{ base: 0, md: 2 }}
                  >
                    <SafeTypist
                      avgTypingDelay={25}
                      cursor={{ show: false }}
                      stdTypingDelay={12}
                    >
                      <Text
                        fontSize={{ base: 'sm', md: 'md' }}
                        lineHeight="1.85"
                        whiteSpace="pre-line"
                        color="#C4B89E"
                        fontStyle="italic"
                      >
                        {fragment.narrative}
                      </Text>
                    </SafeTypist>
                  </Box>

                  {/* All collected banner */}
                  {isAllCollected && (
                    <VStack
                      alignItems="center"
                      spacing={3}
                      border="1px solid"
                      borderColor={`${color}40`}
                      borderRadius="md"
                      p={4}
                      boxShadow={`0 0 20px ${color}15`}
                      bg={`${color}08`}
                    >
                      <Text
                        fontWeight={700}
                        color={color}
                        fontSize="lg"
                        fontFamily="'Cinzel', serif"
                      >
                        Depths Relic Hunter
                      </Text>
                      <Text fontSize="md" textAlign="center" color="#C4B89E">
                        All {TOTAL_FRAGMENTS} fragments collected. The fallen speak
                        through you now. A badge has been forged in your name.
                      </Text>
                    </VStack>
                  )}
                </>
              ) : (
                <>
                  {/* Divider */}
                  <Box mx="auto" w="60px" h="1px" bg={`${color}30`} />

                  {/* Discovery location */}
                  <Text
                    fontSize="xs"
                    color="#5A5147"
                    textAlign="center"
                    fontFamily="mono"
                  >
                    Discovered at ({fragment.triggerTileX}, {fragment.triggerTileY})
                  </Text>
                </>
              )}
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter
          justifyContent="center"
          pt={2}
          pb={5}
          borderTop="1px solid"
          borderColor={`${color}10`}
        >
          {!isClaimed ? (
            <Button
              onClick={handleClaim}
              isLoading={isClaiming}
              loadingText="Claiming..."
              size="lg"
              px={12}
              bg={`${color}20`}
              color={color}
              border="1px solid"
              borderColor={`${color}40`}
              fontFamily="'Cinzel', serif"
              fontSize="sm"
              letterSpacing="wider"
              _hover={{
                bg: `${color}30`,
                borderColor: `${color}70`,
                boxShadow: `0 0 20px ${color}25`,
              }}
              _active={{
                bg: `${color}35`,
              }}
            >
              CLAIM FRAGMENT
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              variant="outline"
              size="md"
              px={10}
              color={color}
              borderColor={`${color}35`}
              fontFamily="'Cinzel', serif"
              fontSize="sm"
              letterSpacing="wide"
              _hover={{
                bg: `${color}10`,
                borderColor: `${color}60`,
              }}
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
