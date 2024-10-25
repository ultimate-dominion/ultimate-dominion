import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  HStack,
  Image,
  Link,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
// import { FaDiscord } from 'react-icons/fa';
// import { FaXTwitter } from 'react-icons/fa6';
import { IoMdMenu } from 'react-icons/io';
import { useLocation, useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  CHARACTER_CREATION_PATH,
  CHARACTERS_PATH,
  GAME_BOARD_PATH,
  HOME_PATH,
  ITEM_PATH,
  LEADERBOARD_PATH,
  MARKETPLACE_PATH,
  SHOP_PATH,
} from '../Routes';
import { BackCaretSvg } from './SVGs';

const PAGES_WITH_BACK_BUTTON = [
  CHARACTERS_PATH,
  LEADERBOARD_PATH,
  MARKETPLACE_PATH,
  SHOP_PATH,
];

export const Header = ({
  onOpenWalletDetailsModal,
}: {
  onOpenWalletDetailsModal: () => void;
}): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { renderError } = useToast();

  const {
    burnerBalance,
    delegatorAddress,
    systemCalls: { endShopEncounter },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [isExiting, setIsExiting] = useState(false);

  const onEndShopEncounter = useCallback(async () => {
    try {
      setIsExiting(true);

      if (!character) {
        throw new Error('Character not found.');
      }

      if (!character.worldEncounter) {
        throw new Error('Not in a shop.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const { error, success } = await endShopEncounter(
        character.worldEncounter.encounterId,
      );

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to exit shop.', e);
    } finally {
      setIsExiting(false);
    }
  }, [
    character,
    delegatorAddress,
    endShopEncounter,
    onClose,
    refreshCharacter,
    renderError,
  ]);

  const onBack = useCallback(() => {
    if (pathname.includes(ITEM_PATH)) {
      navigate(MARKETPLACE_PATH);
      return;
    }

    if (character?.worldEncounter) {
      onEndShopEncounter();
    }

    navigate(-1);
  }, [character, navigate, onEndShopEncounter, pathname]);

  const logoLink = useMemo(() => {
    if (pathname === HOME_PATH) {
      return HOME_PATH;
    }
    return pathname === CHARACTER_CREATION_PATH
      ? CHARACTER_CREATION_PATH
      : GAME_BOARD_PATH;
  }, [pathname]);

  const showWalletDetails = useMemo(() => {
    return (
      pathname !== HOME_PATH &&
      !PAGES_WITH_BACK_BUTTON.includes(`/${pathname.split('/')[1]}`)
    );
  }, [pathname]);

  const showBackButton = useMemo(() => {
    return PAGES_WITH_BACK_BUTTON.includes(`/${pathname.split('/')[1]}`);
  }, [pathname]);

  return (
    <Grid
      as="header"
      bgColor="grey400"
      mt={4}
      px={4}
      py={2}
      templateColumns={{ base: 'repeat(4, 1fr)', lg: 'repeat(1, fr)' }}
      w="100%"
    >
      <GridItem colSpan={{ base: 3, lg: 4 }}>
        <Stack
          direction={{ base: 'column-reverse', lg: 'row' }}
          justify={
            pathname === GAME_BOARD_PATH ||
            pathname === CHARACTER_CREATION_PATH ||
            PAGES_WITH_BACK_BUTTON.includes(`/${pathname.split('/')[1]}`)
              ? 'space-between'
              : 'end'
          }
        >
          <HStack spacing={4}>
            {showWalletDetails && (
              <Button
                alignSelf={{ base: 'start', lg: 'center' }}
                onClick={onOpenWalletDetailsModal}
                fontSize="xs"
                p={4}
                size="sm"
                variant="dark"
              >
                Wallet Details
              </Button>
            )}
            {showBackButton && (
              <Button
                fontSize="xs"
                isLoading={isExiting}
                leftIcon={<BackCaretSvg />}
                onClick={onBack}
                p={4}
                size="sm"
              >
                {character?.worldEncounter ? 'Exit Shop' : 'Back'}
              </Button>
            )}
            {pathname !== HOME_PATH && (
              <Tooltip
                aria-label="Your session wallet balance"
                bg="#070D2A"
                hasArrow
                label="Your session wallet balance"
              >
                <Text size="2xs">
                  Balance: {Number(burnerBalance).toFixed(5)}
                </Text>
              </Tooltip>
            )}
          </HStack>
          <Button
            mb={{ base: pathname !== HOME_PATH ? 4 : 0, sm: 4 }}
            mt={{ base: pathname !== HOME_PATH ? -5 : -4, sm: -5 }}
            onClick={() => navigate(logoLink)}
            variant="unstyled"
          >
            <Image
              alt="Ultimate Dominion Logo"
              src="/images/ultimate-dominion-logo.svg"
              width={{ base: '200px', sm: '225px' }}
            />
          </Button>
        </Stack>
      </GridItem>
      <GridItem
        alignContent="center"
        colSpan={{ base: 1, lg: 0 }}
        display={{ lg: 'none' }}
        textAlign="right"
      >
        <Button
          backgroundColor="#D0D0D0"
          onClick={onOpen}
          p={3}
          size="sm"
          variant="white"
        >
          <IoMdMenu size={20} />
        </Button>
        <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>Menu</DrawerHeader>

            <DrawerBody>
              <Stack
                direction={{ base: 'column' }}
                spacing={{ base: 4, md: 10 }}
              >
                <Link
                  alignSelf="start"
                  fontSize={{ base: 'xs', sm: 'sm' }}
                  href="https://www.ultimatedominion.com/"
                  isExternal
                >
                  About
                </Link>
                {/* <Link alignSelf="start" fontSize={{ base: 'xs', sm: 'sm' }}>
                  Guild Info
                </Link>
                <Link alignSelf="start" fontSize={{ base: 'xs', sm: 'sm' }}>
                  Map Info
                </Link>
                <Link alignSelf="start" fontSize={{ base: 'xs', sm: 'sm' }}>
                  Create Map
                </Link> */}
              </Stack>
            </DrawerBody>

            <DrawerFooter>
              <Stack
                alignItems="center"
                direction={{ base: 'column', sm: 'row' }}
                spacing={{ base: 3, md: 8 }}
              >
                {/* <Link bgColor="black" borderRadius="50%" p={1.5}>
                  <FaDiscord color="white" />
                </Link>
                <Link bgColor="black" borderRadius="50%" p={1.5}>
                  <FaXTwitter color="white" />
                </Link> */}
              </Stack>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </GridItem>
    </Grid>
  );
};
