import {
  Box,
  Button,
  Center,
  Divider,
  Heading,
  Stack,
  useDisclosure,
} from '@chakra-ui/react';

import { ConnectWalletModal } from './ConnectWalletModal';

export const Header = (): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box>
      <Stack backgroundColor="lightgray" direction="row" padding="10px">
        <Heading as="h1" margin="10px" w="50%">
          Ultimate Dominion
        </Heading>
        <Divider opacity="0"></Divider>
        <Center>
          <Button margin="0px auto" onClick={onOpen} textAlign="right">
            Connect
          </Button>
        </Center>
      </Stack>

      <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
};
