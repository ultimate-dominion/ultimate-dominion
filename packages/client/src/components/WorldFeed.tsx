import {
  Box,
  CloseButton,
  Heading,
  HStack,
  keyframes,
  ScaleFade,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from 'react';

import { useChat } from '../contexts/ChatContext';

import { PolygonalCard } from './PolygonalCard';

// Ember glow: a warm pulse from the left border that fades out.
// Uses CSS custom property --glow for per-event color.
const emberGlow = keyframes`
  0% {
    box-shadow: inset 5px 0 14px -3px var(--glow, #C4A54A),
                0 0 6px -1px var(--glow, #C4A54A);
  }
  40% {
    box-shadow: inset 3px 0 8px -2px var(--glow, #C4A54A),
                0 0 3px -1px var(--glow, #C4A54A);
  }
  100% {
    box-shadow: none;
  }
`;

// How recently a message must be to get the glow (ms)
const RECENT_THRESHOLD = 12_000;

type WorldFeedProps = { inline?: boolean };

export const WorldFeed: React.FC<WorldFeedProps> = ({ inline = false }) => {
  const {
    isOpen,
    messages,
    onClose,
  } = useChat();

  // Track mount time so initial load doesn't glow everything
  const mountedAt = useRef(Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen || inline) {
      scrollToBottom();
    }
  }, [inline, isOpen, messages, scrollToBottom]);

  const isVisible = inline || isOpen;
  const now = Date.now();

  const content = (
    <PolygonalCard
      clipPath="none"
      w={inline ? '100%' : { base: 'calc(100vw - 16px)', sm: '365px' }}
      h={inline ? '100%' : undefined}
      display={inline ? 'flex' : undefined}
      flexDirection={inline ? 'column' : undefined}
    >
      <HStack
        bgColor="blue500"
        color="#E8DCC8"
        h={
          inline
            ? '28px'
            : isVisible
              ? { base: '36px', md: '44px' }
              : { base: '0', md: '0' }
        }
        justifyContent="space-between"
        px={3}
        w="100%"
      >
        <Heading fontSize={inline ? 'xs' : { base: 'xs', md: 'sm' }} textTransform="uppercase" letterSpacing="wider">World</Heading>
        {!inline && <CloseButton size="sm" onClick={onClose} />}
      </HStack>
      <Box
        flex={inline ? 1 : undefined}
        minH={inline ? 0 : undefined}
        h={inline ? undefined : isVisible ? { base: '200px', sm: '250px', lg: '300px' } : '0'}
        overflowY="auto"
        transition={inline ? undefined : 'height 0.3s ease'}
      >
        <VStack bg="#14120F" className="data-dense" flex="1" overflowY="auto" px={1.5} py={1} spacing={0.5}>
          {messages.length === 0 && (
            <Text color="#5A5347" fontStyle="italic" mt={4} fontSize="xs" textAlign="center">
              Waiting for world events...
            </Text>
          )}
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showTimestamp =
              !prevMessage ||
              message.timestamp - prevMessage.timestamp > 1000 * 60 * 30;

            // Glow new events that arrived after component mounted
            const isRecent =
              message.timestamp > mountedAt.current - 2000 &&
              now - message.timestamp < RECENT_THRESHOLD;
            const glowColor = message.rarityColor || '#C4A54A';

            return (
              <VStack key={`event-${message.timestamp}-${index}`} w="100%" spacing={0}>
                {showTimestamp && (
                  <Text color="#3A3228" fontSize="9px" py={0.5}>
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
                <Box
                  bg="#1A1610"
                  borderLeft={
                    message.rarityColor
                      ? `2px solid ${message.rarityColor}`
                      : undefined
                  }
                  borderRadius="sm"
                  color="#E8DCC8"
                  px={2}
                  py={0.5}
                  w="100%"
                  fontSize="xs"
                  style={isRecent ? { '--glow': glowColor } as React.CSSProperties : undefined}
                  animation={isRecent ? `${emberGlow} 2s ease-out forwards` : undefined}
                  sx={{ '& p, & a, & span': { fontSize: 'inherit' } }}
                >
                  {message.jsx || (
                    <Text fontWeight={500}>
                      {message.message}
                    </Text>
                  )}
                </Box>
              </VStack>
            );
          })}
          <Box ref={messagesEndRef} />
        </VStack>
      </Box>
    </PolygonalCard>
  );

  if (inline) return content;

  return (
    <ScaleFade initialScale={0.9} in={isOpen}>
      {content}
    </ScaleFade>
  );
};
