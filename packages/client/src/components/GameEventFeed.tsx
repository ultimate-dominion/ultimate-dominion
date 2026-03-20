import { Box, Text, VStack } from '@chakra-ui/react';
import { useMemo, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQueue } from '../contexts/QueueContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { RARITY_COLORS } from '../utils/types';
import { ITEM_PATH } from '../Routes';

type GameEvent = {
  id: string;
  eventType: string;
  playerName: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export const GameEventFeed = (): JSX.Element => {
  const { gameEvents } = useQueue();
  const bottomRef = useRef<HTMLDivElement>(null);

  if (gameEvents.length === 0) {
    return (
      <VStack py={8} spacing={2}>
        <Text color="#5A5040" fontStyle="italic" size="sm">
          Waiting for game events...
        </Text>
        <Text color="#3A3228" size="xs">
          Battles, loot, quests, and new arrivals will appear here
        </Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={1}>
      {gameEvents.map((event) => (
        <Box key={event.id} py={1}>
          <Text
            color={getEventColor(event.eventType)}
            fontFamily="mono"
            fontSize="xs"
            lineHeight="1.5"
          >
            <Text as="span" color="#5A5040" mr={1}>{'>'}</Text>
            <EventContent event={event} />
          </Text>
        </Box>
      ))}
      <div ref={bottomRef} />
    </VStack>
  );
};

/** Resolve player name and item name from client game state */
const EventContent = ({ event }: { event: GameEvent }): JSX.Element => {
  const { armorTemplates, weaponTemplates, consumableTemplates, spellTemplates } = useItems();
  const { allCharacters } = useMap();

  const allItems = useMemo(() => [
    ...armorTemplates, ...weaponTemplates, ...consumableTemplates, ...spellTemplates,
  ], [armorTemplates, weaponTemplates, consumableTemplates, spellTemplates]);

  const meta = event.metadata || {};
  const walletAddress = (meta.walletAddress || meta.attackerWallet) as string | undefined;

  // Resolve player name from wallet address
  const resolvedName = useMemo(() => {
    if (!walletAddress) return null;
    const char = allCharacters.find(c => c.owner?.toLowerCase() === walletAddress.toLowerCase());
    return char?.name || null;
  }, [walletAddress, allCharacters]);

  // Resolve item from metadata
  const resolvedItem = useMemo(() => {
    const itemId = meta.itemId as string | undefined;
    if (!itemId) return null;
    return allItems.find(i => i.tokenId === itemId) || null;
  }, [meta.itemId, allItems]);

  const playerName = resolvedName || event.playerName;
  const nameColor = '#E8DCC8';

  // Loot drops / rare finds
  if ((event.eventType === 'loot_drop' || event.eventType === 'rare_find') && meta.itemId) {
    const rarity = meta.rarity as number | undefined;
    const itemColor = rarity !== undefined ? (RARITY_COLORS[rarity] || '#C4B89E') : '#C4B89E';
    const itemName = resolvedItem?.name || meta.itemName as string || `Item #${meta.itemId}`;
    return (
      <>
        <Text as="span" color={nameColor} fontWeight={700}>{playerName}</Text>
        {' found '}
        <Text as={RouterLink} to={`${ITEM_PATH}/${meta.itemId}`} color={itemColor} fontWeight={700} _hover={{ textDecoration: 'underline' }}>
          {itemName}
        </Text>
        {'!'}
      </>
    );
  }

  // Marketplace listings
  if (event.eventType === 'marketplace_listing' && meta.itemId) {
    const rarity = meta.rarity as number | undefined;
    const itemColor = rarity !== undefined ? (RARITY_COLORS[rarity] || '#C49B5E') : '#C49B5E';
    const itemName = resolvedItem?.name || meta.itemName as string || `Item #${meta.itemId}`;
    const price = meta.price ? formatGold(String(meta.price)) : '?';
    return (
      <>
        <Text as="span" color={nameColor} fontWeight={700}>{playerName}</Text>
        {' listed '}
        <Text as={RouterLink} to={`${ITEM_PATH}/${meta.itemId}`} color={itemColor} fontWeight={700} _hover={{ textDecoration: 'underline' }}>
          {itemName}
        </Text>
        {` for ${price} Gold`}
      </>
    );
  }

  // PvP kills
  if (event.eventType === 'pvp_kill') {
    const defenderWallet = meta.defenderWallet as string | undefined;
    const attackersWin = meta.attackersWin as boolean | undefined;
    const attackerName = resolvedName || 'A player';
    let defenderName = meta.opponentName as string || 'an opponent';
    if (defenderWallet) {
      const defChar = allCharacters.find(c => c.owner?.toLowerCase() === defenderWallet.toLowerCase());
      if (defChar?.name) defenderName = defChar.name;
    }
    const winner = attackersWin ? attackerName : defenderName;
    const loser = attackersWin ? defenderName : attackerName;
    return (
      <>
        <Text as="span" color="#B85C3A" fontWeight={700}>{winner}</Text>
        {' defeated '}
        <Text as="span" color={nameColor} fontWeight={700}>{loser}</Text>
        {' in PvP!'}
      </>
    );
  }

  // Deaths
  if (event.eventType === 'death') {
    const mobName = meta.mobName as string || 'a monster';
    return (
      <>
        <Text as="span" color={nameColor} fontWeight={700}>{playerName}</Text>
        {` was slain by ${mobName}.`}
      </>
    );
  }

  // Fallback: render description as-is
  return <>{event.description}</>;
};

function formatGold(weiStr: string): string {
  try {
    const gold = Number(BigInt(weiStr) / BigInt(10 ** 18));
    const frac = Number(BigInt(weiStr) % BigInt(10 ** 18)) / 1e18;
    const total = gold + frac;
    return total > 0 ? String(Math.round(total * 10) / 10) : '0';
  } catch {
    return '?';
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'loot_drop':
      return '#C4B89E'; // parchment
    case 'rare_find':
      return '#D4A54A'; // gold — stands out for rare+ items
    case 'pvp_kill':
      return '#B85C3A'; // burnt orange — victory
    case 'death':
      return '#8B4040'; // dark red — defeat
    case 'level_up':
      return '#4A8B4A'; // green
    case 'character_created':
      return '#9B8EC4'; // purple — new arrival
    case 'marketplace_listing':
      return '#C49B5E'; // amber — commerce
    default:
      return '#8A7E6A';
  }
}
