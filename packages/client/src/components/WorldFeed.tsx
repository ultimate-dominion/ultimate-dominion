import {
  Box,
  CloseButton,
  Heading,
  HStack,
  ScaleFade,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from 'react';

import { useChat } from '../contexts/ChatContext';

import { PolygonalCard } from './PolygonalCard';

type WorldFeedProps = { inline?: boolean };

export const WorldFeed: React.FC<WorldFeedProps> = ({ inline = false }) => {
  const {
    isOpen,
    messages,
    onClose,
  } = useChat();

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
            ? '36px'
            : isVisible
              ? { base: '40px', md: '66px' }
              : { base: '0', md: '0' }
        }
        justifyContent="space-between"
        px={4}
        w="100%"
      >
        <Heading size={inline ? 'sm' : { base: 'sm', md: 'md' }}>World</Heading>
        {!inline && <CloseButton onClick={onClose} />}
      </HStack>
      <Box
        flex={inline ? 1 : undefined}
        minH={inline ? 0 : undefined}
        h={inline ? undefined : isVisible ? { base: '200px', sm: '250px', lg: '300px' } : '0'}
        overflowY="auto"
        transition={inline ? undefined : 'height 0.3s ease'}
      >
        <VStack bg="#14120F" className="data-dense" flex="1" overflowY="auto" p={2} spacing={2}>
          {messages.length === 0 && (
            <Text color="#5A5347" fontStyle="italic" mt={4} size="sm" textAlign="center">
              Waiting for world events...
            </Text>
          )}
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showTimestamp =
              !prevMessage ||
              message.timestamp - prevMessage.timestamp > 1000 * 60 * 30;

            return (
              <VStack key={`event-${message.timestamp}-${index}`} mt={1} w="100%">
                {showTimestamp && (
                  <Text color="#5A5347" size="2xs">
                    &mdash;{' '}
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    &mdash;
                  </Text>
                )}
                <Box
                  bg="#1A1610"
                  borderLeft={
                    message.rarityColor
                      ? `3px solid ${message.rarityColor}`
                      : undefined
                  }
                  borderRadius="md"
                  boxShadow="2px 2px 6px rgba(0,0,0,0.4)"
                  color="#E8DCC8"
                  p={2}
                  w="100%"
                >
                  {message.jsx || (
                    <Text fontWeight={500} size="xs" textAlign="center">
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
