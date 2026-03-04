import { Box, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { useQueue } from '../contexts/QueueContext';

export const GameEventFeed = (): JSX.Element => {
  const { gameEvents } = useQueue();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameEvents.length]);

  if (gameEvents.length === 0) {
    return (
      <VStack py={8} spacing={2}>
        <Text color="#5A5040" fontStyle="italic" size="sm">
          Waiting for game events...
        </Text>
        <Text color="#3A3228" size="xs">
          Battles, loot drops, and level ups will appear here
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
    case 'rare_find':
      return '#D4A54A'; // gold
    case 'pvp_kill':
      return '#8B4040'; // red
    case 'level_up':
      return '#4A8B4A'; // green
    case 'marketplace_sale':
      return '#6A8AB0'; // blue
    default:
      return '#8A7E6A';
  }
}
