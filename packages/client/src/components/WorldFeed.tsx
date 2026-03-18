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
