import {
  Box,
  Button,
  Heading,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
} from '@chakra-ui/react';

import { ConnectWalletModal } from './ConnectWalletModal';

export const Header = (): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box padding={'10px'}>
      <Menu placement="top-end">
        <MenuButton as={Box} textAlign={'right'} backgroundColor={'lightgray'}>
          <Heading as={'h1'} margin={'10px'}>
            Ultimate Dominion
          </Heading>
        </MenuButton>
        <MenuList>
          <MenuItem>
            <Button margin={'0px auto'} onClick={onOpen}>
              Connect
            </Button>
          </MenuItem>
        </MenuList>
      </Menu>
      <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
};
