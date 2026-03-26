import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import { type FragmentStatus } from '../contexts/FragmentContext';
import { getFragmentColor, getFragmentImage } from '../utils/fragmentImages';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

/* ──────────────────────── Animations ──────────────────────── */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const artReveal = keyframes`
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
`;

const glowPulse = (color: string) => keyframes`
  0%, 100% { box-shadow: 0 0 20px 4px ${color}30, 0 0 50px 8px ${color}15; }
  50%      { box-shadow: 0 0 30px 6px ${color}45, 0 0 70px 12px ${color}22; }
`;

const titleGlow = (color: string) => keyframes`
  0%, 100% { text-shadow: 0 0 8px ${color}40, 0 0 20px ${color}20; }
  50%      { text-shadow: 0 0 14px ${color}60, 0 0 30px ${color}30; }
`;

/* ──────────────────────── Component ──────────────────────── */

type FragmentReadModalProps = {
  fragment: FragmentStatus;
  isOpen: boolean;
  onClose: () => void;
};

export const FragmentReadModal = ({
  fragment,
  isOpen,
  onClose,
}: FragmentReadModalProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const color = getFragmentColor(fragment.name);
  const imageSrc = getFragmentImage(fragment.name);
  const modalSize = useBreakpointValue({ base: 'full', md: '2xl' });

  // Stagger content reveal when modal opens
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(t);
    }
    setShowContent(false);
  }, [isOpen]);

  const claimedDate = fragment.claimedAt
    ? new Date(fragment.claimedAt * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            {/* ── Hero artwork ── */}
            {imageSrc ? (
              <Box
                position="relative"
                opacity={showContent ? 1 : 0}
                animation={showContent ? `${artReveal} 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards` : undefined}
              >
                <Image
                  src={imageSrc}
                  alt={fragment.name}
                  w="100%"
                  maxH={{ base: '50vh', md: '420px' }}
                  objectFit="contain"
                  bg="#0A0908"
                />
                {/* Bottom gradient fade into content */}
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  h="80px"
                  bgGradient="linear(to-t, #1C1814, transparent)"
                />
                {/* Glow border along bottom edge of image */}
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  h="2px"
                  bg={`${color}50`}
                  animation={`${glowPulse(color)} 4s ease-in-out infinite`}
                />
                {/* CLAIMED badge */}
                <Box
                  position="absolute"
                  top={3}
                  right={3}
                  bg={`${color}20`}
                  border="1px solid"
                  borderColor={`${color}50`}
                  px={2.5}
                  py={0.5}
                  borderRadius="sm"
                >
                  <Text fontSize="xs" fontWeight="bold" color={color} letterSpacing="wider">
                    {t('fragmentRead.claimed')}
                  </Text>
                </Box>
              </Box>
            ) : (
              /* Placeholder when no art exists */
              <Box
                h={{ base: '30vh', md: '200px' }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={`${color}08`}
                position="relative"
                animation={showContent ? `${artReveal} 0.6s ease-out forwards` : undefined}
                opacity={showContent ? 1 : 0}
              >
                <Text
                  color={`${color}60`}
                  fontSize="sm"
                  fontFamily="'Cinzel', serif"
                  letterSpacing="widest"
                  textTransform="uppercase"
                >
                  {t('fragmentRead.fragmentOf', { num: getRomanNumeral(fragment.fragmentType), total: getRomanNumeral(TOTAL_FRAGMENTS) })}
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
                <Box
                  position="absolute"
                  top={3}
                  right={3}
                  bg={`${color}20`}
                  border="1px solid"
                  borderColor={`${color}50`}
                  px={2.5}
                  py={0.5}
                  borderRadius="sm"
                >
                  <Text fontSize="xs" fontWeight="bold" color={color} letterSpacing="wider">
                    {t('fragmentRead.claimed')}
                  </Text>
                </Box>
              </Box>
            )}

            {/* ── Text content ── */}
            <VStack
              spacing={5}
              align="stretch"
              px={{ base: 5, md: 8 }}
              pt={4}
              pb={6}
              opacity={showContent ? 1 : 0}
              animation={showContent ? `${fadeIn} 0.6s 0.3s cubic-bezier(0.16, 1, 0.3, 1) both` : undefined}
            >
              {/* Fragment number */}
              <Text
                textAlign="center"
                color={`${color}80`}
                fontSize="xs"
                fontFamily="'Cinzel', serif"
                letterSpacing="widest"
                textTransform="uppercase"
              >
                {t('fragmentRead.fragmentOf', { num: getRomanNumeral(fragment.fragmentType), total: getRomanNumeral(TOTAL_FRAGMENTS) })}
              </Text>

              {/* Title with glow */}
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

              {/* Thin decorative divider */}
              <Box
                mx="auto"
                w="60px"
                h="1px"
                bg={`${color}30`}
              />

              {/* Narrative text */}
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                lineHeight="1.85"
                whiteSpace="pre-line"
                color="#C4B89E"
                fontStyle="italic"
                px={{ base: 0, md: 2 }}
                sx={{
                  '& em, & i': {
                    color,
                    fontStyle: 'italic',
                  },
                }}
              >
                {fragment.narrative}
              </Text>

              {/* Claim metadata */}
              <VStack spacing={0.5} pt={2}>
                <Text fontSize="xs" color="#5A5147" fontFamily="mono">
                  {t('fragmentRead.claimedDate', { date: claimedDate })}
                </Text>
                <Text fontSize="xs" color="#5A5147" fontFamily="mono">
                  {t('fragmentRead.tokenId', { id: fragment.tokenId.toString() })}
                </Text>
              </VStack>
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter
          justifyContent="center"
          pt={0}
          pb={5}
          borderTop="1px solid"
          borderColor={`${color}10`}
        >
          <Button
            onClick={onClose}
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
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
