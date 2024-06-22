import {
  Button,
  Container,
  Heading,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback } from 'react';

// import { useNavigate } from 'react-router-dom';
// import { useAccount } from 'wagmi';
import { ConnectWalletModal } from '../components/ConnectWalletModal';
// import { useMUD } from '../contexts/MUDContext';

export const Welcome = (): JSX.Element => {
  // const navigate = useNavigate();
  const { isOpen, onClose } = useDisclosure();
  // const { isConnected } = useAccount();
  // const { delegatorAddress } = useMUD();

  const onPlay = useCallback(async () => {
    const data = await fetch('/api/hello').then(res => res.json());
    // eslint-disable-next-line no-console
    console.log(data);
    // if (!(delegatorAddress && isConnected)) {
    //   onOpen();
    //   return;
    // }

    // navigate('character-creation');
    // }, [delegatorAddress, isConnected, navigate, onOpen]);
  }, []);

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
        <Button onClick={onPlay}>Play</Button>
      </VStack>
      <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
    </Container>
  );
};
