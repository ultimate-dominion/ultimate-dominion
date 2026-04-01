import { Box, Button, HStack, keyframes, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

/* ──────────────────────── Keyframes ──────────────────────── */

const promptFadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const backdropFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const shimmer = keyframes`
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
`;

/* ──────────────────────── Component ──────────────────────── */

type ZoneExitPromptProps = {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ZoneExitPrompt = ({
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: ZoneExitPromptProps): JSX.Element | null => {
  const { t } = useTranslation('ui');

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={9998}
      display="flex"
      alignItems={{ base: 'flex-end', md: 'center' }}
      justifyContent="center"
      animation={`${backdropFadeIn} 0.3s ease-out`}
    >
      {/* Backdrop */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.700"
        backdropFilter="blur(4px)"
        onClick={isLoading ? undefined : onCancel}
        cursor={isLoading ? 'default' : 'pointer'}
      />

      {/* Prompt card */}
      <VStack
        position="relative"
        bg="#1C1814"
        border="1px solid rgba(180, 198, 212, 0.2)"
        borderRadius={{ base: '16px 16px 0 0', md: '12px' }}
        boxShadow="0 0 60px rgba(180, 198, 212, 0.08), 0 0 120px rgba(180, 198, 212, 0.04)"
        px={{ base: 6, md: 10 }}
        py={{ base: 8, md: 10 }}
        maxW="440px"
        w={{ base: '100%', md: 'auto' }}
        spacing={6}
        animation={`${promptFadeIn} 0.4s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both`}
      >
        {/* Shimmer accent line */}
        <Box
          w="80px"
          h="1px"
          background="linear-gradient(90deg, transparent, #B4C6D4, transparent)"
          backgroundSize="200% 100%"
          animation={`${shimmer} 4s ease-in-out infinite`}
        />

        {/* Narrative text */}
        <Text
          fontFamily="'Cinzel', serif"
          fontSize={{ base: 'sm', md: 'md' }}
          fontStyle="italic"
          color="#B4C6D4"
          textAlign="center"
          lineHeight="1.8"
          textShadow="0 0 20px rgba(180, 198, 212, 0.15)"
        >
          {t('zoneExit.narrative')}
        </Text>

        {/* Reassurance */}
        <Text
          fontSize="xs"
          color="#8A7E6A"
          textAlign="center"
          fontFamily="mono"
        >
          {t('zoneExit.reassurance')}
        </Text>

        {/* Buttons */}
        <HStack spacing={4} w="100%">
          <Button
            flex={1}
            variant="outline"
            color="#8A7E6A"
            borderColor="#3A3228"
            fontFamily="'Cinzel', serif"
            fontSize="sm"
            letterSpacing="0.05em"
            _hover={{ borderColor: '#8A7E6A', color: '#C4B89E' }}
            onClick={onCancel}
            isDisabled={isLoading}
          >
            {t('zoneExit.stay')}
          </Button>
          <Button
            flex={1}
            variant="gold"
            fontFamily="'Cinzel', serif"
            fontSize="sm"
            letterSpacing="0.05em"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText={t('zoneExit.transitioning')}
          >
            {t('zoneExit.leave')}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};
