import {
  Box,
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
  IconButton,
  Image,
  Link,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { IoMdMenu } from 'react-icons/io';
import { IoSettingsOutline } from 'react-icons/io5';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import {
  CHARACTER_CREATION_PATH,
  CHARACTERS_PATH,
  GAME_BOARD_PATH,
  HOME_PATH,
  LEADERBOARD_PATH,
  MARKETPLACE_PATH,
} from '../Routes';

type NavItem = {
  label: string;
  path: string;
  isActive: (pathname: string) => boolean;
};

export const Header = (): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    delegatorAddress,
    onOpenWalletDetailsModal,
    systemCalls: { endWorldEncounter },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const onEndShopEncounter = useCallback(async () => {
    if (!character) return false;
    if (!character.worldEncounter) return true;
    if (!delegatorAddress) return false;

    // Use endWorldEncounter (EncounterResolveSystem.endEncounter) instead of
    // endShopEncounter (ShopSystem) because the ShopSystem path calls
    // triggerFragment via World which hits MUD's prohibitDirectCallback.
    const { success } = await endWorldEncounter(
      character.worldEncounter!.encounterId,
    );
    if (!success) {
      console.warn('[Header] endWorldEncounter failed, encounter likely already ended');
    }
    await refreshCharacter();
    return true;
  }, [
    character,
    delegatorAddress,
    endWorldEncounter,
    refreshCharacter,
  ]);

  const shopGuardedNavigate = useCallback(
    async (to: string) => {
      if (character?.worldEncounter) {
        setNavigatingTo(to);
        const exited = await onEndShopEncounter();
        setNavigatingTo(null);
        if (!exited) return;
      }
      navigate(to);
    },
    [character, navigate, onEndShopEncounter],
  );

  const logoLink = useMemo(() => {
    if (pathname === HOME_PATH) {
      return HOME_PATH;
    }
    return pathname === CHARACTER_CREATION_PATH
      ? CHARACTER_CREATION_PATH
      : GAME_BOARD_PATH;
  }, [pathname]);

  // Show nav only when character is loaded (past Welcome/CharacterCreation)
  const showNav = useMemo(() => {
    return (
      pathname !== HOME_PATH &&
      pathname !== CHARACTER_CREATION_PATH &&
      !!character?.id
    );
  }, [character?.id, pathname]);

  const navItems: NavItem[] = useMemo(() => {
    if (!character?.id) return [];
    return [
      {
        label: 'Game',
        path: GAME_BOARD_PATH,
        isActive: (p: string) => p === GAME_BOARD_PATH,
      },
      {
        label: 'Character',
        path: `${CHARACTERS_PATH}/${character.id}`,
        isActive: (p: string) => p.startsWith(CHARACTERS_PATH),
      },
      {
        label: 'Marketplace',
        path: MARKETPLACE_PATH,
        isActive: (p: string) => p.startsWith(MARKETPLACE_PATH),
      },
      {
        label: 'Leaderboard',
        path: LEADERBOARD_PATH,
        isActive: (p: string) => p === LEADERBOARD_PATH,
      },
    ];
  }, [character?.id]);

  const handleDrawerNav = useCallback(
    async (to: string) => {
      onClose();
      await shopGuardedNavigate(to);
    },
    [onClose, shopGuardedNavigate],
  );

  return (
    <Grid
      as="header"
      bgColor={pathname === HOME_PATH ? 'transparent' : '#1C1814'}
      mt={4}
      px={4}
      py={2}
      templateColumns={{ base: '1fr auto', lg: '1fr' }}
      w="100%"
    >
      <GridItem colSpan={1}>
        <Stack
          align="center"
          direction={{ base: 'column-reverse', lg: 'row' }}
          justify="space-between"
        >
          {/* Desktop nav items */}
          {showNav && (
            <HStack
              display={{ base: 'none', lg: 'flex' }}
              spacing={6}
            >
              {navItems.map(item => {
                const active = item.isActive(pathname);
                const isLoading = navigatingTo === item.path;
                return (
                  <Box
                    key={item.label}
                    as="button"
                    borderBottom="2px solid"
                    borderColor={active ? '#C87A2A' : 'transparent'}
                    color={active ? '#E8DCC8' : '#8A7E6A'}
                    cursor="pointer"
                    fontFamily="Cinzel, serif"
                    fontSize="13px"
                    fontWeight={600}
                    letterSpacing="0.05em"
                    onClick={() => shopGuardedNavigate(item.path)}
                    pb={1}
                    textTransform="uppercase"
                    transition="color 0.2s ease, border-color 0.2s ease"
                    _hover={{ color: '#C4B89E' }}
                  >
                    {isLoading ? (
                      <Spinner size="xs" />
                    ) : (
                      item.label
                    )}
                  </Box>
                );
              })}
            </HStack>
          )}

          {/* Logo */}
          <Button
            mb={{ base: pathname !== HOME_PATH ? 2 : 0, sm: 2 }}
            mt={{ base: pathname !== HOME_PATH ? -1 : 0, sm: -1 }}
            onClick={() => navigate(logoLink)}
            variant="unstyled"
          >
            <Image
              alt="Ultimate Dominion Logo"
              src="/images/ultimate-dominion-logo.svg"
              width={{ base: '200px', sm: '225px' }}
            />
          </Button>

          {/* Desktop settings gear */}
          {showNav && (
            <IconButton
              aria-label="Settings"
              color="#8A7E6A"
              display={{ base: 'none', lg: 'flex' }}
              icon={<IoSettingsOutline size={20} />}
              onClick={onOpenWalletDetailsModal}
              size="sm"
              variant="unstyled"
              _hover={{ color: '#C4B89E' }}
            />
          )}
        </Stack>
      </GridItem>

      {/* Mobile hamburger + drawer */}
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
              <Stack direction="column" spacing={4}>
                {showNav ? (
                  <>
                    {navItems.map(item => {
                      const active = item.isActive(pathname);
                      return (
                        <Text
                          key={item.label}
                          as="button"
                          alignSelf="start"
                          color={active ? '#E8DCC8' : '#8A7E6A'}
                          fontFamily="Cinzel, serif"
                          fontSize="sm"
                          fontWeight={active ? 700 : 500}
                          onClick={() => handleDrawerNav(item.path)}
                          textAlign="left"
                          textTransform="uppercase"
                          _hover={{ color: '#C4B89E' }}
                        >
                          {item.label}
                        </Text>
                      );
                    })}
                    <Text
                      as="button"
                      alignSelf="start"
                      color="#8A7E6A"
                      fontSize="sm"
                      fontWeight={500}
                      onClick={() => {
                        onClose();
                        onOpenWalletDetailsModal();
                      }}
                      textAlign="left"
                      _hover={{ color: '#C4B89E' }}
                    >
                      Settings
                    </Text>
                  </>
                ) : null}
                <Link
                  alignSelf="start"
                  color="#8A7E6A"
                  fontSize="sm"
                  href="https://www.ultimatedominion.com/"
                  isExternal
                >
                  About
                </Link>
              </Stack>
            </DrawerBody>

            <DrawerFooter>
              <Stack
                direction="row"
                spacing={4}
                w="100%"
                justify="center"
              >
                <Link
                  color="#8A7E6A"
                  fontSize="2xs"
                  href="https://ultimatedominion.com/terms"
                  isExternal
                >
                  Terms
                </Link>
                <Link
                  color="#8A7E6A"
                  fontSize="2xs"
                  href="https://ultimatedominion.com/privacy"
                  isExternal
                >
                  Privacy
                </Link>
                <Link
                  color="#8A7E6A"
                  fontSize="2xs"
                  href="https://www.ultimatedominion.com/"
                  isExternal
                >
                  About
                </Link>
              </Stack>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </GridItem>
    </Grid>
  );
};
