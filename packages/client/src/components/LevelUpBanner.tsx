import { Box, keyframes, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const goldenGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 8px rgba(212, 165, 74, 0.4),
      0 0 20px rgba(212, 165, 74, 0.2),
      inset 0 0 8px rgba(212, 165, 74, 0.1);
    border-color: rgba(200, 122, 42, 0.6);
  }
  50% {
    box-shadow:
      0 0 14px rgba(212, 165, 74, 0.8),
      0 0 32px rgba(212, 165, 74, 0.4),
      0 0 48px rgba(212, 165, 74, 0.15),
      inset 0 0 12px rgba(212, 165, 74, 0.2);
    border-color: rgba(239, 211, 28, 0.9);
  }
`;

const scaleIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  60% {
    opacity: 1;
    transform: scale(1.04);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`;

type LevelUpBannerProps = {
  level: bigint;
};

export const LevelUpBanner: React.FC<LevelUpBannerProps> = ({ level }) => {
  const { t } = useTranslation('ui');
  return (
    <Box
      animation={`${scaleIn} 0.5s ease-out, ${goldenGlow} 2.5s ease-in-out infinite`}
      bg="rgba(212, 165, 74, 0.08)"
      border="1px solid"
      borderColor="rgba(200, 122, 42, 0.6)"
      borderRadius="md"
      px={6}
      py={4}
      w="100%"
    >
      <VStack spacing={1}>
        <Text
          animation={`${shimmer} 3s linear infinite`}
          backgroundClip="text"
          backgroundImage="linear-gradient(90deg, #D4A54A 0%, #EFD31C 25%, #D4A54A 50%, #EFD31C 75%, #D4A54A 100%)"
          backgroundSize="200% auto"
          fontFamily="heading"
          fontSize="2xl"
          fontWeight="bold"
          letterSpacing="wider"
          sx={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {t('levelUp.banner')}
        </Text>
        <Text color="#E8DCC8" fontFamily="heading" fontSize="lg">
          {t('levelUp.bannerReached', { level: level.toString() })}
        </Text>
      </VStack>
    </Box>
  );
};
