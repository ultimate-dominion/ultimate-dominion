import {
  Button,
  HStack,
  Icon,
  Image,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import {
  CHARACTER_CREATION_PATH,
  CHARACTERS_PATH,
  GAME_BOARD_PATH,
  HOME_PATH,
  LEADERBOARD_PATH,
} from '../Routes';

const PAGES_WITHOUT_WALLET_DETAILS = [
  HOME_PATH,
  LEADERBOARD_PATH,
  CHARACTERS_PATH,
];
const PAGES_WITH_BACK_BUTTON = [LEADERBOARD_PATH, CHARACTERS_PATH];
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
        !PAGES_WITHOUT_WALLET_DETAILS.includes(`/${pathname.split('/')[1]}`) ||
        PAGES_WITH_BACK_BUTTON.includes(`/${pathname.split('/')[1]}`)
          ? 'space-between'
          : 'end'
      }
      mt={4}
      mb={10}
      p={{ base: 1, lg: 2 }}
    >
      {PAGES_WITH_BACK_BUTTON.includes(`/${pathname.split('/')[1]}`) && (
        <Button
          leftIcon={
            <Icon>
              <svg
                width="8"
                viewBox="0 0 8 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.47541 11.7489C7.1093 12.0837 6.5157 12.0837 6.14959 11.7489L0.524588 6.60609C0.158472 6.27136 0.158472 5.72864 0.524588 5.39391L6.14959 0.251051C6.5157 -0.0836841 7.1093 -0.083684 7.47541 0.251051C7.84153 0.585786 7.84153 1.1285 7.47541 1.46323L2.51333 6L7.47541 10.5368C7.84153 10.8715 7.84153 11.4142 7.47541 11.7489Z"
                  fill="#F2F2F2"
                />
              </svg>
            </Icon>
          }
          ml="60px"
          onClick={() => navigate(-1)}
          size="lg"
        >
          Game Board
        </Button>
      )}
      {!PAGES_WITHOUT_WALLET_DETAILS.includes(`/${pathname.split('/')[1]}`) && (
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
