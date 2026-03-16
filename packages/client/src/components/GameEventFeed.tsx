import { Box, Text, VStack } from '@chakra-ui/react';
import { useRef } from 'react';
import { useQueue } from '../contexts/QueueContext';

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
            {event.description}
          </Text>
        </Box>
      ))}
      <div ref={bottomRef} />
    </VStack>
  );
};

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
    case 'marketplace_sale':
      return '#6A8AB0'; // blue
    case 'character_created':
      return '#9B8EC4'; // purple — new arrival
    case 'shop_purchase':
      return '#8A9E7A'; // sage — commerce
    case 'quest_complete':
      return '#C4A54A'; // amber — achievement
    default:
      return '#8A7E6A';
  }
}
