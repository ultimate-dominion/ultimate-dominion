import {
  Box,
  Button,
  Heading,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PolygonalCard } from '../components/PolygonalCard';
import { RespecPanel } from '../components/RespecPanel';
import { useAuth } from '../contexts/AuthContext';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';

const RESPEC_NPC_NAME = 'Vel Morrow';
const RESPEC_NPC_TITLE = 'Combat Trainer, Windy Peaks';

export const Respec = (): JSX.Element | null => {
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const { isAuthenticated, isConnecting } = useAuth();

  const onLeave = useCallback(() => {
    navigate(GAME_BOARD_PATH);
  }, [navigate]);

  useEffect(() => {
    if (!isConnecting && !isAuthenticated) {
      navigate(HOME_PATH);
    }
  }, [isAuthenticated, isConnecting, navigate]);

  if (!isAuthenticated) return null;

  return (
    <Box>
      <Helmet>
        <title>Redistribute Stats | Ultimate Dominion</title>
      </Helmet>
      <HStack bgColor="#1C1814" color="#E8DCC8" h="68px" px={6}>
        <VStack align="start" spacing={0}>
          <Heading size={{ base: 'sm', md: 'md' }}>{RESPEC_NPC_NAME}</Heading>
          <Text color="#8A7E6A" fontSize="xs" fontStyle="italic">
            {RESPEC_NPC_TITLE}
          </Text>
        </VStack>
        <Spacer />
        <Button
          bg="#2A2520"
          border="1px solid #3A3228"
          color="#C4B89E"
          fontFamily="Cinzel, serif"
          fontSize="xs"
          fontWeight={600}
          letterSpacing="0.05em"
          onClick={onLeave}
          px={4}
          size="sm"
          textTransform="uppercase"
          _hover={{ bg: '#3A3228', color: '#E8DCC8' }}
        >
          {t('shop.leaveShop')}
        </Button>
      </HStack>

      <Box px={{ base: 4, md: 8 }} py={{ base: 6, md: 10 }} maxW="640px" mx="auto">
        <PolygonalCard clipPath="none" p={6}>
          <RespecPanel />
        </PolygonalCard>
      </Box>
    </Box>
  );
};
