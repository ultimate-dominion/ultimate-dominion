import {
  Avatar,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import {
  ADVANCED_CLASS_COLORS,
  ADVANCED_CLASS_NAMES,
  AdvancedClass,
  type Character,
  StatsClasses,
} from '../utils/types';

// ── Constants ──

const STAT_TYPE_MAP: Record<number, 'str' | 'agi' | 'int'> = {
  [StatsClasses.Strength]: 'str',
  [StatsClasses.Agility]: 'agi',
  [StatsClasses.Intelligence]: 'int',
};

const STAT_COLORS = {
  str: '#B85C3A',
  agi: '#3A9A8A',
  int: '#7B4AB5',
};

const FILTER_TABS: { label: string; value: 'all' | 'str' | 'agi' | 'int' }[] = [
  { label: 'All', value: 'all' },
  { label: 'STR', value: 'str' },
  { label: 'AGI', value: 'agi' },
  { label: 'INT', value: 'int' },
];

// Density breakpoints
const EXPANDED_THRESHOLD = 10;
const DENSE_THRESHOLD = 30;

// ── Helpers ──

function getPlayerStatus(character: Character): {
  label: string;
  color: string;
} | null {
  if (
    !(character as any).worldEncounter &&
    character.inBattle
  ) {
    return { label: 'roster.inBattle', color: '#B83A2A' };
  }
  if ((character as any).worldEncounter) {
    return { label: 'roster.shopping', color: '#EFD31C' };
  }
  const cooldownTimer = character.pvpCooldownTimer;
  if (cooldownTimer && Number(cooldownTimer) + 30 > Date.now() / 1000) {
    return { label: 'roster.cooldown', color: '#8A7E6A' };
  }
  return null;
}

function isSafeZone(x: number, y: number): boolean {
  return x < 5 && y < 5;
}

// ── OnlineLink (the trigger on the map) ──

export const OnlineLink = (): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { allCharacters } = useMap();
  const { t } = useTranslation('ui');

  const spawnedPlayers = useMemo(
    () => allCharacters.filter((c) => c.isSpawned),
    [allCharacters],
  );

  const count = spawnedPlayers.length;

  return (
    <>
      <HStack
        as="button"
        onClick={onOpen}
        spacing={1.5}
        cursor="pointer"
        bg="none"
        border="none"
        p={0}
        role="group"
      >
        <Box
          w="7px"
          h="7px"
          bg="#5A8A3E"
          borderRadius="50%"
          boxShadow="0 0 6px rgba(90,138,62,0.3)"
          sx={{
            animation: 'onlinePulse 2.5s ease-in-out infinite',
            '@keyframes onlinePulse': {
              '0%, 100%': {
                opacity: 1,
                boxShadow: '0 0 6px rgba(90,138,62,0.3)',
              },
              '50%': {
                opacity: 0.65,
                boxShadow: '0 0 10px rgba(90,138,62,0)',
              },
            },
          }}
        />
        <Text
          color="#5A8A3E"
          fontSize={{ base: '2xs', sm: 'xs' }}
          fontWeight={500}
          transition="color 0.2s ease"
          _groupHover={{ color: '#6BA04E' }}
          sx={{
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: '-1px',
              left: 0,
              width: '0%',
              height: '1px',
              bg: '#5A8A3E',
              opacity: 0.5,
              transition: 'width 0.3s ease',
            },
            '.chakra-stack:hover &::after': {
              width: '100%',
              opacity: 1,
            },
          }}
        >
          {count === 1 ? t('roster.playerOnline', { count }) : t('roster.playersOnline', { count })}
        </Text>
      </HStack>

      <OnlineRosterDrawer
        isOpen={isOpen}
        onClose={onClose}
        players={spawnedPlayers}
      />
    </>
  );
};

// ── Roster Drawer ──

const OnlineRosterDrawer = ({
  isOpen,
  onClose,
  players,
}: {
  isOpen: boolean;
  onClose: () => void;
  players: Character[];
}) => {
  const [filter, setFilter] = useState<'all' | 'str' | 'agi' | 'int'>('all');
  const [search, setSearch] = useState('');
  const { delegatorAddress } = useMUD();
  const { t } = useTranslation('ui');

  // Sort by level desc, keep current player in list
  const sortedPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => Number(b.level) - Number(a.level));
  }, [players]);

  // Apply filter + search
  const filteredPlayers = useMemo(() => {
    let result = sortedPlayers;

    if (filter !== 'all') {
      result = result.filter(
        (c) => STAT_TYPE_MAP[c.entityClass] === filter,
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    return result;
  }, [sortedPlayers, filter, search]);

  // Assign rank based on sorted position
  const rankedPlayers = useMemo(() => {
    return sortedPlayers.map((p, i) => ({ player: p, rank: i + 1 }));
  }, [sortedPlayers]);

  const getRank = (playerId: string): number => {
    const entry = rankedPlayers.find((r) => r.player.id === playerId);
    return entry?.rank ?? 0;
  };

  const isCurrentPlayer = (c: Character): boolean =>
    c.owner.toLowerCase() === delegatorAddress?.toLowerCase();

  const count = sortedPlayers.length;
  const mode: 'expanded' | 'compact' | 'dense' =
    count < EXPANDED_THRESHOLD
      ? 'expanded'
      : count < DENSE_THRESHOLD
        ? 'compact'
        : 'dense';

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="sm">
      <DrawerOverlay bg="rgba(0,0,0,0.35)" />
      <DrawerContent
        bg="#1C1814"
        borderLeft="1px solid rgba(196,184,158,0.08)"
        maxW="340px"
        sx={{
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, #5A8A3E, transparent)',
            opacity: 0.35,
          },
        }}
      >
        <DrawerCloseButton
          color="#8A7E6A"
          top={4}
          right={4}
          _hover={{ color: '#E8DCC8' }}
        />
        <DrawerHeader
          borderBottom="1px solid rgba(196,184,158,0.08)"
          pb={3}
          pt={4}
          px={5}
          bg="linear-gradient(180deg, rgba(36,32,26,0.8) 0%, transparent 100%)"
        >
          <VStack align="start" spacing={2.5}>
            <HStack spacing={2.5}>
              <Text
                fontFamily="heading"
                fontSize="13px"
                fontWeight={600}
                color="#E8DCC8"
                letterSpacing="2.5px"
                textTransform="uppercase"
              >
                {t('roster.online')}
              </Text>
              <HStack
                spacing={1.5}
                bg="rgba(90,138,62,0.1)"
                border="1px solid rgba(90,138,62,0.15)"
                borderRadius="4px"
                px={2}
                py={0.5}
              >
                <Box
                  w="5px"
                  h="5px"
                  bg="#5A8A3E"
                  borderRadius="50%"
                  sx={{
                    animation: 'onlinePulse 2.5s ease-in-out infinite',
                    '@keyframes onlinePulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.65 },
                    },
                  }}
                />
                <Text fontFamily="mono" fontSize="11px" color="#5A8A3E">
                  {count}
                </Text>
              </HStack>
            </HStack>

            {/* Filter tabs */}
            <HStack spacing={0.5}>
              {FILTER_TABS.map((tab) => (
                <Box
                  key={tab.value}
                  as="button"
                  px={2.5}
                  py={1}
                  borderRadius="4px"
                  fontSize="12px"
                  fontWeight={500}
                  cursor="pointer"
                  transition="all 0.2s ease"
                  letterSpacing="0.5px"
                  bg={
                    filter === tab.value
                      ? tab.value === 'all'
                        ? 'rgba(200,122,42,0.08)'
                        : `${STAT_COLORS[tab.value as 'str' | 'agi' | 'int']}12`
                      : 'transparent'
                  }
                  color={
                    filter === tab.value
                      ? tab.value === 'all'
                        ? '#C87A2A'
                        : STAT_COLORS[tab.value as 'str' | 'agi' | 'int']
                      : '#8A7E6A'
                  }
                  _hover={{
                    color: '#C4B89E',
                    bg: 'rgba(196,184,158,0.05)',
                  }}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                </Box>
              ))}
            </HStack>
          </VStack>
        </DrawerHeader>

        <DrawerBody px={0} py={1} overflowY="auto">
          {mode === 'compact' || mode === 'dense' ? (
            <GroupedPlayerList
              players={filteredPlayers}
              mode={mode}
              getRank={getRank}
              isCurrentPlayer={isCurrentPlayer}
            />
          ) : (
            filteredPlayers.map((p) => (
              <PlayerRow
                key={p.id}
                character={p}
                mode={mode}
                rank={getRank(p.id)}
                isSelf={isCurrentPlayer(p)}
              />
            ))
          )}

          {filteredPlayers.length === 0 && (
            <Text
              color="#5A5248"
              fontSize="13px"
              textAlign="center"
              py={8}
            >
              {t('roster.noPlayersFound')}
            </Text>
          )}
        </DrawerBody>

        {/* Search footer */}
        <Box
          px={5}
          py={2.5}
          borderTop="1px solid rgba(196,184,158,0.08)"
          bg="linear-gradient(0deg, rgba(36,32,26,0.6) 0%, transparent 100%)"
        >
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <IoSearch color="#5A5248" size={14} />
            </InputLeftElement>
            <Input
              placeholder={t('roster.searchPlayers')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              bg="#14120F"
              border="1px solid rgba(196,184,158,0.08)"
              borderRadius="6px"
              color="#C4B89E"
              fontSize="13px"
              pl={8}
              _placeholder={{ color: '#5A5248' }}
              _focus={{ borderColor: 'rgba(90,138,62,0.3)' }}
            />
          </InputGroup>
        </Box>
      </DrawerContent>
    </Drawer>
  );
};

// ── Grouped list (compact / dense) ──

const GroupedPlayerList = ({
  players,
  mode,
  getRank,
  isCurrentPlayer,
}: {
  players: Character[];
  mode: 'compact' | 'dense';
  getRank: (id: string) => number;
  isCurrentPlayer: (c: Character) => boolean;
}) => {
  const { t } = useTranslation('ui');
  const groups = useMemo(() => {
    if (mode === 'dense') {
      // Group by class
      const byClass: Record<string, Character[]> = {};
      for (const p of players) {
        const cls =
          ADVANCED_CLASS_NAMES[p.advancedClass] || StatsClasses[p.entityClass];
        if (!byClass[cls]) byClass[cls] = [];
        byClass[cls].push(p);
      }
      return Object.entries(byClass).sort((a, b) => b[1].length - a[1].length);
    }

    // Compact: group by tile
    const byTile: Record<string, Character[]> = {};
    for (const p of players) {
      const key = `${p.position.x},${p.position.y}`;
      if (!byTile[key]) byTile[key] = [];
      byTile[key].push(p);
    }
    return Object.entries(byTile).sort((a, b) => b[1].length - a[1].length);
  }, [players, mode]);

  return (
    <>
      {groups.map(([label, list]) => {
        const isTileGroup = mode === 'compact';
        const [x, y] = isTileGroup ? label.split(',').map(Number) : [0, 0];
        const safe = isTileGroup && isSafeZone(x, y);

        return (
          <Box key={label} mb={0.5}>
            <HStack
              px={5}
              pt={2}
              pb={1}
              spacing={2}
            >
              <Text
                fontFamily="mono"
                fontSize="10px"
                color="#5A5248"
                textTransform="uppercase"
                letterSpacing="1.5px"
                whiteSpace="nowrap"
              >
                {isTileGroup ? t('roster.tile', { label }) : label}
                {safe && ` \u00b7 ${t('roster.safe')}`}
                {` (${list.length})`}
              </Text>
              <Box flex={1} h="1px" bg="rgba(196,184,158,0.08)" />
            </HStack>
            {list.map((p) => (
              <PlayerRow
                key={p.id}
                character={p}
                mode={mode}
                rank={getRank(p.id)}
                isSelf={isCurrentPlayer(p)}
              />
            ))}
          </Box>
        );
      })}
    </>
  );
};

// ── Player Row ──

const PlayerRow = ({
  character,
  mode,
  rank,
  isSelf = false,
}: {
  character: Character;
  mode: 'expanded' | 'compact' | 'dense';
  rank: number;
  isSelf?: boolean;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const status = getPlayerStatus(character);
  const classColor =
    ADVANCED_CLASS_COLORS[character.advancedClass] ?? '#8A7E6A';
  const className =
    ADVANCED_CLASS_NAMES[character.advancedClass] ||
    StatsClasses[character.entityClass];
  const safe = isSafeZone(character.position.x, character.position.y);

  const isExpanded = mode === 'expanded';
  const isDense = mode === 'dense';

  const py = isDense ? 1 : isExpanded ? 3 : 2;
  const avatarSize = isDense ? '2xs' : isExpanded ? 'sm' : 'xs';

  return (
    <HStack
      px={5}
      py={py}
      spacing={3}
      cursor="pointer"
      transition="background 0.15s ease"
      _hover={{ bg: '#2E2820' }}
      onClick={() => navigate(`/characters/${character.id}`)}
      position="relative"
      sx={{
        '&:not(:last-child)::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: '20px',
          right: '20px',
          height: '1px',
          bg: 'rgba(196,184,158,0.08)',
        },
      }}
    >
      {/* Avatar */}
      <Avatar
        name={character.name}
        src={character.image || undefined}
        size={avatarSize}
        borderRadius="6px"
        border={`1.5px solid ${classColor}30`}
        bg="#24201A"
      />

      {/* Info */}
      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <HStack spacing={1.5} w="100%">
          <Text
            fontFamily="heading"
            fontSize={isExpanded ? '14px' : '13px'}
            fontWeight={600}
            color="#E8DCC8"
            noOfLines={1}
            lineHeight="1.2"
          >
            {character.name}
          </Text>
          {isSelf && (
            <Text
              fontFamily="mono"
              fontSize="9px"
              color="#5A8A3E"
              opacity={0.7}
              flexShrink={0}
            >
              {t('roster.you')}
            </Text>
          )}
          {status && (
            <Text
              fontFamily="mono"
              fontSize="9px"
              px={1.5}
              py={0}
              borderRadius="3px"
              color={status.color}
              bg={`${status.color}18`}
              border={`1px solid ${status.color}22`}
              letterSpacing="0.3px"
              flexShrink={0}
              lineHeight="1.6"
            >
              {t(status.label)}
            </Text>
          )}
        </HStack>

        <HStack spacing={2}>
          <Text
            fontSize="11.5px"
            fontWeight={500}
            color={classColor}
          >
            {className}
          </Text>
          <Text color="#5A5248" fontSize="8px">
            &bull;
          </Text>
          <Text fontFamily="mono" fontSize="10px" color="#5A5248">
            {character.position.x},{character.position.y}
            {safe && (
              <Text as="span" color="#5A8A3E" opacity={0.7}>
                {' '}
                {t('roster.safe')}
              </Text>
            )}
          </Text>
        </HStack>

        {/* Expanded: stat pips */}
        {isExpanded && (
          <HStack spacing={1.5} mt={1}>
            <StatPip label="STR" value={Number(character.strength)} color={STAT_COLORS.str} />
            <StatPip label="AGI" value={Number(character.agility)} color={STAT_COLORS.agi} />
            <StatPip label="INT" value={Number(character.intelligence)} color={STAT_COLORS.int} />
          </HStack>
        )}
      </VStack>

      {/* Right: level + rank */}
      <VStack spacing={0.5} align="end" flexShrink={0}>
        <Text
          fontFamily="mono"
          fontSize={isDense ? '10px' : '11px'}
          fontWeight={500}
          color="#C87A2A"
          bg="rgba(200,122,42,0.08)"
          px={isDense ? 1 : 1.5}
          py={0}
          borderRadius="4px"
          border="1px solid rgba(200,122,42,0.12)"
          lineHeight="1.5"
        >
          {t('roster.lv', { level: character.level.toString() })}
        </Text>
        <Text
          fontFamily="mono"
          fontSize="9px"
          color="#5A5248"
          letterSpacing="0.5px"
        >
          #{rank}
        </Text>
      </VStack>
    </HStack>
  );
};

// ── Stat pip ──

const StatPip = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <HStack spacing={1} fontFamily="mono" fontSize="9.5px" color={color}>
    <Box w="4px" h="10px" borderRadius="1px" bg={color} opacity={0.7} />
    <Text>{value}</Text>
  </HStack>
);
