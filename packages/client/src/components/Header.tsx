import { Box, Button, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, HOME_PATH } from '../Routes';

const PAGES_WITHOUT_HEADER = [HOME_PATH];

export const Header = ({
  onOpenWalletDetailsModal,
}: {
  onOpenWalletDetailsModal: () => void;
}): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { burnerBalance } = useMUD();

  if (PAGES_WITHOUT_HEADER.includes(pathname)) {
    return <Box />;
  }

  return (
    <Stack
      as="header"
      bgColor={{ base: 'white', lg: 'grey300' }}
      direction={{ base: 'column-reverse', lg: 'row' }}
      justify="space-between"
      mt={8}
      padding={{ base: 1, lg: 2 }}
    >
      <HStack>
        <Button
          alignSelf={{ base: 'start', lg: 'center' }}
          bgColor="white"
          onClick={onOpenWalletDetailsModal}
          size="xs"
          variant="outline"
        >
          Wallet Details
        </Button>
        <Text size="2xs">Balance: {Number(burnerBalance).toFixed(5)}</Text>
      </HStack>
      <Heading
        as="button"
        onClick={() =>
          navigate(
            pathname === CHARACTER_CREATION_PATH
              ? CHARACTER_CREATION_PATH
              : GAME_BOARD_PATH,
          )
        }
        size={{ base: 'sm', sm: 'md' }}
        textAlign={{ base: 'left', lg: 'right' }}
      >
        Ultimate Dominion
      </Heading>
    </Stack>
  );
};
