import { Button, HStack, Image, Stack, Text, Tooltip } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, HOME_PATH } from '../Routes';

const PAGES_WITHOUT_WALLET_DETAILS = [HOME_PATH];

export const Header = ({
  onOpenWalletDetailsModal,
}: {
  onOpenWalletDetailsModal: () => void;
}): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { burnerBalance } = useMUD();

  const logoLink = useMemo(() => {
    if (pathname === HOME_PATH) {
      return HOME_PATH;
    }
    return pathname === CHARACTER_CREATION_PATH
      ? CHARACTER_CREATION_PATH
      : GAME_BOARD_PATH;
  }, [pathname]);

  return (
    <Stack
      as="header"
      bgColor="grey400"
      direction={{ base: 'column-reverse', lg: 'row' }}
      justify={
        !PAGES_WITHOUT_WALLET_DETAILS.includes(pathname)
          ? 'space-between'
          : 'end'
      }
      mt={4}
      px={4}
      py={2}
    >
      {!PAGES_WITHOUT_WALLET_DETAILS.includes(pathname) && (
        <HStack spacing={4}>
          <Button
            alignSelf={{ base: 'start', lg: 'center' }}
            onClick={onOpenWalletDetailsModal}
            p={4}
            fontSize="xs"
            size="sm"
            variant="dark"
          >
            Wallet Details
          </Button>
          <Tooltip
            aria-label="Your session wallet balance"
            bg="black"
            hasArrow
            label="Your session wallet balance"
          >
            <Text size="2xs">Balance: {Number(burnerBalance).toFixed(5)}</Text>
          </Tooltip>
        </HStack>
      )}
      <Button
        mb={4}
        mt={-5}
        onClick={() => navigate(logoLink)}
        variant="unstyled"
      >
        <Image
          alt="Ultimate Dominion Logo"
          src="/images/ultimate-dominion-logo.svg"
          width="225px"
        />
      </Button>
    </Stack>
  );
};
