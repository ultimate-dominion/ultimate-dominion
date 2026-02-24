import {
  Box,
  Button,
  Heading,
  Progress,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { ConnectWalletModal } from '../components/ConnectWalletModal';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, MANIFESTO_PATH } from '../Routes';

export const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { authMethod, isAuthenticated } = useAuth();
  const {
    components: { SyncProgress },
    delegatorAddress,
  } = useMUD();
  const { character } = useCharacter();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  const [syncStalled, setSyncStalled] = useState(false);

  useEffect(() => {
    if (syncProgress && syncProgress.step === SyncStep.LIVE) {
      setSyncStalled(false);
      return;
    }

    const timer = setTimeout(() => {
      setSyncStalled(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, [syncProgress]);

  const onPlay = useCallback(() => {
    // Embedded path: authenticated = ready to go (no delegation needed)
    if (authMethod === 'embedded' && isAuthenticated) {
      if (character?.locked) {
        navigate(GAME_BOARD_PATH);
      } else {
        navigate(CHARACTER_CREATION_PATH);
      }
      return;
    }

    // External path: need both connection and delegation
    if (!(delegatorAddress && isAuthenticated)) {
      onOpen();
      return;
    }

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
    } else {
      navigate(CHARACTER_CREATION_PATH);
    }
  }, [authMethod, character, delegatorAddress, isAuthenticated, navigate, onOpen]);

  return (
    <Box border="6px solid #1A244E" p={1.5}>
      <Box border="0.5px solid #1A244E">
        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 20, sm: 32 }}
          px={{ base: 2, sm: 12, md: 20 }}
          spacing={{ base: 12, md: 16 }}
        >
          <VStack spacing={4}>
            <Heading
              size={{ base: 'md', md: 'lg' }}
              textAlign="center"
              textTransform="uppercase"
            >
              Welcome to Ultimate Dominion
            </Heading>
            <Button
              as={RouterLink}
              to={MANIFESTO_PATH}
              variant="outline"
              size="sm"
            >
              Read the Manifesto
            </Button>
          </VStack>
          <VStack fontWeight={500} maxW="850px" spacing={6} textAlign="center">
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              As you awaken, your eyes flutter open to the stark, eerie ambiance
              of a dimly lit cave.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              Confusion clouds your mind; the cold, hard ground beneath you
              offers no comfort. Glimpses of blood and bruises on your body only
              deepen the mystery, painting a silent story of unseen struggles.
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              Where are you? How did you end up here?
            </Text>
            <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
              The shadows around you hold secrets, whispering tales of survival
              and discovery. Gathering your strength, you rise, the weight of
              uncertainty heavy on your shoulders — yet igniting a spark of
              determination within. With a deep breath, you take your first step
              into the unknown, embarking on a journey where every choice carves
              your path through the darkness.
            </Text>
          </VStack>

          {syncProgress && syncProgress.step !== SyncStep.LIVE ? (
            <VStack justify="center" w={{ base: '80%', sm: '50%' }}>
              <Text>Loading {Math.round(syncProgress.percentage)}%</Text>
              <Progress value={Math.round(syncProgress.percentage)} w="100%" />
              {syncStalled && (
                <VStack spacing={2} mt={2}>
                  <Text size="xs" color="grey500" textAlign="center">
                    Taking longer than expected...
                  </Text>
                  <Button
                    onClick={() => window.location.reload()}
                    size="sm"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </VStack>
              )}
            </VStack>
          ) : (
            <Button onClick={onPlay}>Play</Button>
          )}
          <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
        </VStack>
      </Box>
    </Box>
  );
};
