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
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useMemo } from 'react';
import { IoMdMenu } from 'react-icons/io';
import { IoSettingsOutline } from 'react-icons/io5';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';
import { SoundToggle } from './SoundToggle';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useQueue } from '../contexts/QueueContext';
import { IS_BETA, SHOW_Z2 } from '../lib/env';
import {
  BLOG_URL,
  CHARACTER_CREATION_PATH,
  CHARACTERS_PATH,
  GAME_BOARD_PATH,
  GUIDE_PATH,
  HOME_PATH,
  GUILD_PATH,
  LEADERBOARD_PATH,
  MARKETPLACE_PATH,
  WAITING_ROOM_PATH,
} from '../Routes';

const TAVERN_URL = 'https://tavern.ultimatedominion.com';

type NavItem = {
  label: string;
  path: string;
  isActive: (pathname: string) => boolean;
};

export const Header = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    onOpenWalletDetailsModal,
    systemCalls: { endShopEncounter },
  } = useMUD();
  const { character } = useCharacter();
  const { queuePosition, queueStatus } = useQueue();

  const shopGuardedNavigate = useCallback(
    (to: string) => {
      if (character?.worldEncounter?.encounterId) {
        endShopEncounter(character.worldEncounter.encounterId).catch(() => {});
      }
      navigate(to, character?.worldEncounter ? { state: { fromShop: true } } : undefined);
    },
    [character, endShopEncounter, navigate],
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

  const inQueue = queueStatus === 'waiting' || queueStatus === 'ready';

  const navItems: NavItem[] = useMemo(() => {
    if (!character?.id) return [];
    const items: NavItem[] = [
      {
        label: t('nav.game'),
        path: GAME_BOARD_PATH,
        isActive: (p: string) => p === GAME_BOARD_PATH,
      },
      {
        label: t('nav.character'),
        path: `${CHARACTERS_PATH}/${character.id}`,
        isActive: (p: string) => p.startsWith(CHARACTERS_PATH),
      },
      {
        label: t('nav.marketplace'),
        path: MARKETPLACE_PATH,
        isActive: (p: string) => p.startsWith(MARKETPLACE_PATH),
      },
      ...(SHOW_Z2
        ? [{ label: t('nav.guild'), path: GUILD_PATH, isActive: (p: string) => p === GUILD_PATH }]
        : []),
      {
        label: t('nav.leaderboard'),
        path: LEADERBOARD_PATH,
        isActive: (p: string) => p === LEADERBOARD_PATH,
      },
    ];
    if (inQueue) {
      items.push({
        label: t('queue.position', { position: queuePosition }),
        path: WAITING_ROOM_PATH,
        isActive: (p: string) => p === WAITING_ROOM_PATH,
      });
    }
    return items;
  }, [character?.id, inQueue, queuePosition, t]);

  const handleDrawerNav = useCallback(
    async (to: string) => {
      onClose();
      await shopGuardedNavigate(to);
    },
    [onClose, shopGuardedNavigate],
  );

  return (
    <>
    {IS_BETA && (
      <Box
        bg="#C87A2A"
        color="#1C1814"
        fontSize="13px"
        fontWeight={700}
        letterSpacing="0.1em"
        py="2px"
        textAlign="center"
        textTransform="uppercase"
        w="100%"
      >
        {t('beta.banner')}
      </Box>
    )}
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
                return (
                  <Box
                    key={item.label}
                    as="button"
                    borderBottom="2px solid"
                    borderColor={active ? '#C87A2A' : 'transparent'}
                    color={active ? '#E8DCC8' : '#8A7E6A'}
                    cursor="pointer"
                    fontFamily="Cinzel, serif"
                    fontSize="15px"
                    fontWeight={600}
                    letterSpacing="0.05em"
                    onClick={() => shopGuardedNavigate(item.path)}
                    pb={1}
                    textTransform="uppercase"
                    transition="color 0.2s ease, border-color 0.2s ease"
                    _hover={{ color: '#C4B89E' }}
                  >
                    {item.label}
                  </Box>
                );
              })}
              <Box h="16px" borderLeft="1px solid #2A2218" mx={1} />
              <Box
                as="button"
                borderBottom="2px solid"
                borderColor={pathname.startsWith(GUIDE_PATH) ? '#C87A2A' : 'transparent'}
                color={pathname.startsWith(GUIDE_PATH) ? '#E8DCC8' : '#6A6050'}
                cursor="pointer"
                fontFamily="Cinzel, serif"
                fontSize="15px"
                fontWeight={600}
                letterSpacing="0.05em"
                onClick={() => shopGuardedNavigate(GUIDE_PATH)}
                pb={1}
                textTransform="uppercase"
                transition="color 0.2s ease, border-color 0.2s ease"
                _hover={{ color: '#C4B89E' }}
              >
                {t('nav.guide')}
              </Box>
              <Link
                borderBottom="2px solid transparent"
                color="#6A6050"
                fontFamily="Cinzel, serif"
                fontSize="15px"
                fontWeight={600}
                href={BLOG_URL}
                isExternal
                letterSpacing="0.05em"
                pb={1}
                textTransform="uppercase"
                transition="color 0.2s ease"
                _hover={{ color: '#C4B89E', textDecoration: 'none' }}
              >
                {t('nav.blog')}
              </Link>
              <Link
                borderBottom="2px solid transparent"
                color="#6A6050"
                fontFamily="Cinzel, serif"
                fontSize="15px"
                fontWeight={600}
                href={TAVERN_URL}
                isExternal
                letterSpacing="0.05em"
                pb={1}
                textTransform="uppercase"
                transition="color 0.2s ease"
                _hover={{ color: '#C4B89E', textDecoration: 'none' }}
              >
                {t('nav.tavern')}
              </Link>
            </HStack>
          )}

          {/* Logo + settings gear — right-aligned on desktop */}
          <HStack spacing={2}>
            <Button
              mb={{ base: pathname !== HOME_PATH ? 2 : 0, sm: 2 }}
              mt={{ base: pathname !== HOME_PATH ? -1 : 0, sm: -1 }}
              onClick={() => navigate(logoLink)}
              variant="unstyled"
            >
              <Image
                alt="Ultimate Dominion Logo"
                src="/images/ud-logo-dark-horizontal.svg"
                width={{ base: '180px', sm: '220px' }}
              />
            </Button>
            <SoundToggle />
            <LanguageSwitcher />
            {pathname !== HOME_PATH && (
              <IconButton
                aria-label={t('nav.settings')}
                color="#8A7E6A"
                display={{ base: 'none', lg: 'flex' }}
                icon={<IoSettingsOutline size={20} />}
                onClick={onOpenWalletDetailsModal}
                size="sm"
                variant="unstyled"
                _hover={{ color: '#C4B89E' }}
              />
            )}
          </HStack>
        </Stack>
      </GridItem>

      {/* Mobile hamburger + drawer */}
      <GridItem
        alignContent="center"
        display={{ lg: 'none' }}
        textAlign="right"
      >
        <Button
          aria-label={t('header.openMenu')}
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
            <DrawerHeader color="#D4A54A">{t('nav.menu')}</DrawerHeader>

            <DrawerBody>
              <Stack direction="column" spacing={4}>
                {showNav && navItems.map(item => {
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
                <Box borderTop="1px solid #2A2218" mt={2} pt={2}>
                  <Stack direction="column" spacing={4}>
                    <Text
                      as="button"
                      alignSelf="start"
                      color={pathname.startsWith(GUIDE_PATH) ? '#E8DCC8' : '#8A7E6A'}
                      fontFamily="Cinzel, serif"
                      fontSize="sm"
                      fontWeight={pathname.startsWith(GUIDE_PATH) ? 700 : 500}
                      onClick={() => handleDrawerNav(GUIDE_PATH)}
                      textAlign="left"
                      textTransform="uppercase"
                      _hover={{ color: '#C4B89E' }}
                    >
                      {t('nav.guide')}
                    </Text>
                    <Link
                      alignSelf="start"
                      color="#8A7E6A"
                      fontFamily="Cinzel, serif"
                      fontSize="sm"
                      fontWeight={500}
                      href={BLOG_URL}
                      isExternal
                      textTransform="uppercase"
                      _hover={{ color: '#C4B89E', textDecoration: 'none' }}
                    >
                      {t('nav.blog')}
                    </Link>
                    <Link
                      alignSelf="start"
                      color="#8A7E6A"
                      fontFamily="Cinzel, serif"
                      fontSize="sm"
                      fontWeight={500}
                      href={TAVERN_URL}
                      isExternal
                      textTransform="uppercase"
                      _hover={{ color: '#C4B89E', textDecoration: 'none' }}
                    >
                      {t('nav.tavern')}
                    </Link>
                  </Stack>
                </Box>
                {pathname !== HOME_PATH && (
                  <Text
                    as="button"
                    alignSelf="start"
                    color="#8A7E6A"
                    fontSize="sm"
                    fontWeight={500}
                    mt={4}
                    onClick={() => {
                      onClose();
                      onOpenWalletDetailsModal();
                    }}
                    textAlign="left"
                    _hover={{ color: '#C4B89E' }}
                  >
                    {t('nav.settings')}
                  </Text>
                )}
                <Link
                  alignSelf="start"
                  color="#8A7E6A"
                  fontSize="sm"
                  href="https://www.ultimatedominion.com/"
                  isExternal
                >
                  {t('nav.about')}
                </Link>
                <HStack spacing={2} mt={2}>
                  <Text color="#8A7E6A" fontSize="sm">{t('nav.sound')}</Text>
                  <SoundToggle />
                </HStack>
                <HStack spacing={2} mt={2}>
                  <LanguageSwitcher />
                </HStack>
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
                  {t('nav.terms')}
                </Link>
                <Link
                  color="#8A7E6A"
                  fontSize="2xs"
                  href="https://ultimatedominion.com/privacy"
                  isExternal
                >
                  {t('nav.privacy')}
                </Link>
                <Link
                  color="#8A7E6A"
                  fontSize="2xs"
                  href="https://www.ultimatedominion.com/"
                  isExternal
                >
                  {t('nav.about')}
                </Link>
              </Stack>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </GridItem>
    </Grid>
    </>
  );
};
