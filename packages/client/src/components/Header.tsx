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
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useMemo } from 'react';
// import { FaDiscord } from 'react-icons/fa';
// import { FaXTwitter } from 'react-icons/fa6';
import { IoMdMenu } from 'react-icons/io';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
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
  const {
    delegatorAddress,
    systemCalls: { endShopEncounter },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const exitShopTx = useTransaction({ actionName: 'exit shop' });

  const onEndShopEncounter = useCallback(async () => {
    if (!character) return;
    if (!character.worldEncounter) return;
    if (!delegatorAddress) return;

    const result = await exitShopTx.execute(async () => {
      const { error, success } = await endShopEncounter(
        character.worldEncounter!.encounterId,
      );
      if (error && !success) throw new Error(error);
    });

    if (result !== undefined) {
      await refreshCharacter();
      onClose();
    }
  }, [
    character,
    delegatorAddress,
    endShopEncounter,
    exitShopTx,
    onClose,
    refreshCharacter,
  ]);

  const onBack = useCallback(async () => {
    if (pathname.includes(ITEM_PATH)) {
      navigate(MARKETPLACE_PATH);
      return;
    }

    if (character?.worldEncounter) {
      await onEndShopEncounter();
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
      bgColor="#1C1814"
      mt={4}
      px={4}
      py={2}
      templateColumns={{ base: '1fr auto', lg: '1fr' }}
      w="100%"
    >
      <GridItem colSpan={1}>
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
                Account
              </Button>
            )}
            {showBackButton && (
              <Button
                fontSize="xs"
                isLoading={exitShopTx.isLoading}
                leftIcon={<BackCaretSvg />}
                onClick={onBack}
                p={4}
                size="sm"
              >
                {character?.worldEncounter ? 'Exit Shop' : 'Back'}
              </Button>
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
              filter="sepia(0.2) brightness(1.3)"
              src="/images/ultimate-dominion-logo.svg"
              width={{ base: '200px', sm: '225px' }}
            />
          </Button>
        </Stack>
      </GridItem>
      <GridItem
        alignContent="center"
        display={{ lg: 'none' }}
        textAlign="right"
      >
        <Button
          aria-label="Open menu"
          backgroundColor="#24201A"
          onClick={onOpen}
          p={3}
          size="sm"
          variant="white"
        >
          <IoMdMenu size={20} />
        </Button>
        <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent bg="#1C1814" color="#E8DCC8">
            <DrawerCloseButton />
            <DrawerHeader color="#D4A54A">Menu</DrawerHeader>

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
                <Link
                  alignSelf="start"
                  as={RouterLink}
                  fontSize={{ base: 'xs', sm: 'sm' }}
                  onClick={onClose}
                  to={MARKETPLACE_PATH}
                >
                  Marketplace
                </Link>
                <Link
                  alignSelf="start"
                  as={RouterLink}
                  fontSize={{ base: 'xs', sm: 'sm' }}
                  onClick={onClose}
                  to={LEADERBOARD_PATH}
                >
                  Leaderboard
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
