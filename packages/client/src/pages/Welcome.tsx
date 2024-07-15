import {
  Button,
  Container,
  Heading,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { ConnectWalletModal } from '../components/ConnectWalletModal';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH } from '../Routes';

export const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { isConnected } = useAccount();
  const {
    components: { SyncProgress },
    delegatorAddress,
  } = useMUD();
  const { character } = useCharacter();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  const onPlay = useCallback(() => {
    if (!(delegatorAddress && isConnected)) {
      onOpen();
      return;
    }

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
    } else {
      navigate(CHARACTER_CREATION_PATH);
    }
  }, [character, delegatorAddress, isConnected, navigate, onOpen]);

  return (
    <Container maxW="800px">
      <VStack
        justifyContent="center"
        mb={10}
        mt={{ base: 20, sm: 32 }}
        spacing={{ base: 12, sm: 20 }}
      >
        <Heading textAlign="center">Welcome to Ultimate Dominion</Heading>
        <VStack spacing={6} textAlign="center">
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            As you awaken, your eyes flutter open to the stark, eerie ambiance
            of a dimly lit cave. Confusion clouds your mind; the cold, hard
            ground beneath you offers no comfort. Glimpses of blood and bruises
            on your body only deepen the mystery, painting a silent story of
            unseen struggles.
          </Text>
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            Where are you? How did you end up here?
          </Text>
          <Text size={{ base: 'xs', sm: 'sm', md: 'md' }}>
            The shadows around you hold secrets, whispering tales of survival
            and discovery. Gathering your strength, you rise, the weight of
            uncertainty heavy on your shoulders yet igniting a spark of
            determination within. With a deep breath, you take your first step
            into the unknown, embarking on a journey where every choice carves
            your path through the darkness.
          </Text>
        </VStack>

        {syncProgress && syncProgress.step !== SyncStep.LIVE ? (
          <Text>
            {syncProgress.message} {Math.round(syncProgress.percentage)}%
          </Text>
        ) : (
          <Button onClick={onPlay}>Play</Button>
        )}
      </VStack>
      <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
    </Container>
  );
};
