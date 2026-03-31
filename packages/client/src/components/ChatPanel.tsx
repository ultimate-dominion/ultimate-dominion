import {
  Box,
  HStack,
  Input,
  keyframes,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoIosSend } from 'react-icons/io';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useChat, type ActiveTab, type ChatMessage, type FeedMessage } from '../contexts/ChatContext';
import { useMap } from '../contexts/MapContext';
import { CLASS_COLORS } from '../utils/types';
import { CHARACTERS_PATH } from '../Routes';
import { PolygonalCard } from './PolygonalCard';

// Ember glow animation for recent world events
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

const RECENT_THRESHOLD = 12_000;

type ChatPanelProps = { inline?: boolean };

export const ChatPanel: React.FC<ChatPanelProps> = ({ inline = false }) => {
  const {
    activeTab,
    setActiveTab,
    worldMessages,
    globalMessages,
    guildMessages,
    guildId,
    sendMessage,
    isSending,
    isOpen,
    onClose,
    onSetMessageInputFocus,
    worldUnread,
    globalUnread,
    guildUnread,
  } = useChat();
  const { t } = useTranslation('ui');

  const tabs: { key: ActiveTab; label: string; unread: number }[] = [
    { key: 'world', label: 'World', unread: worldUnread },
    { key: 'global', label: 'Global', unread: globalUnread },
    ...(guildId ? [{ key: 'guild' as ActiveTab, label: 'Guild', unread: guildUnread }] : []),
  ];

  const isVisible = inline || isOpen;
  if (!isVisible && !inline) return null;

  return (
    <PolygonalCard
      clipPath="none"
      w={inline ? '100%' : { base: 'calc(100vw - 16px)', sm: '365px' }}
      h={inline ? '100%' : undefined}
      display={inline ? 'flex' : undefined}
      flexDirection={inline ? 'column' : undefined}
    >
      {/* Tab strip */}
      <HStack
        bgColor="blue500"
        h={inline ? '28px' : { base: '40px', md: '28px' }}
        px={2}
        spacing={0}
        w="100%"
      >
        {tabs.map(tab => (
          <HStack
            key={tab.key}
            as="button"
            cursor="pointer"
            h="100%"
            px={2}
            spacing={1}
            borderBottom={activeTab === tab.key ? '2px solid #C87A2A' : '2px solid transparent'}
            onClick={() => setActiveTab(tab.key)}
            transition="border-color 0.2s"
            _hover={{ borderBottomColor: activeTab === tab.key ? '#C87A2A' : '#5A5347' }}
          >
            <Text
              color={activeTab === tab.key ? '#E8DCC8' : '#5A5347'}
              fontSize="xs"
              fontWeight={600}
              letterSpacing="wider"
              textTransform="uppercase"
              transition="color 0.2s"
            >
              {tab.label}
            </Text>
            {tab.unread > 0 && (
              <Box
                alignItems="center"
                bg="red.500"
                borderRadius="full"
                color="white"
                display="flex"
                fontSize="9px"
                fontWeight="bold"
                h="14px"
                justifyContent="center"
                minW="14px"
                px="3px"
              >
                {tab.unread > 9 ? '9+' : tab.unread}
              </Box>
            )}
          </HStack>
        ))}
        {!inline && (
          <Box flex={1} />
        )}
        {!inline && (
          <Box
            as="button"
            aria-label="Close chat"
            color="#5A5347"
            cursor="pointer"
            fontSize="sm"
            onClick={onClose}
            p={2}
            _hover={{ color: '#8A7E6A' }}
          >
            &times;
          </Box>
        )}
      </HStack>

      {/* Tab content */}
      <Box
        flex={inline ? 1 : undefined}
        minH={inline ? 0 : undefined}
        h={inline ? undefined : { base: '300px', sm: '350px' }}
        overflowY="auto"
        bg="#14120F"
      >
        {activeTab === 'world' && <WorldTab messages={worldMessages} />}
        {activeTab === 'global' && <ChatTab messages={globalMessages} />}
        {activeTab === 'guild' && <ChatTab messages={guildMessages} />}
      </Box>

      {/* Input bar (only for chat channels) */}
      {activeTab !== 'world' && (
        <ChatInput
          channel={activeTab === 'guild' && guildId ? `guild:${guildId}` : 'global'}
          isSending={isSending}
          onSend={sendMessage}
          onFocusChange={onSetMessageInputFocus}
        />
      )}
    </PolygonalCard>
  );
};

// ── World Tab ──────────────────────────────────────────────────
// System events, newest-first, ember glow on recent items

const WorldTab: React.FC<{ messages: FeedMessage[] }> = ({ messages }) => {
  const mountedAt = useRef(Date.now());
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const now = Date.now();

  return (
    <VStack className="data-dense" flex="1" overflowY="auto" px={1.5} py={1} spacing={0.5}>
      {reversed.length === 0 && (
        <Text color="#5A5347" fontStyle="italic" mt={4} fontSize="xs" textAlign="center">
          The realm is silent...
        </Text>
      )}
      {reversed.map((message, index) => {
        const nextMessage = reversed[index + 1];
        const showTimestamp =
          !nextMessage ||
          message.timestamp - nextMessage.timestamp > 1000 * 60 * 30;

        const isRecent =
          message.timestamp > mountedAt.current - 2000 &&
          now - message.timestamp < RECENT_THRESHOLD;
        const glowColor = message.rarityColor || '#C4A54A';

        return (
          <VStack key={`event-${message.timestamp}-${index}`} w="100%" spacing={0}>
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
            {showTimestamp && (
              <Text color="#3A3228" fontSize="9px" py={0.5}>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </VStack>
        );
      })}
    </VStack>
  );
};

// ── Chat Tab ──────────────────────────────────────────────────
// Player messages, oldest-first, auto-scroll to bottom

const ChatTab: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
  const { allCharacters } = useMap();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <VStack className="data-dense" flex="1" overflowY="auto" p={2} spacing={1.5}>
      {messages.length === 0 && (
        <Text color="#5A5347" fontStyle="italic" mt={4} fontSize="xs" textAlign="center">
          No messages yet. Say something.
        </Text>
      )}
      {messages.map((msg, index) => {
        const prevMsg = messages[index - 1];
        const showTimestamp =
          !prevMsg ||
          msg.timestamp - prevMsg.timestamp > 1000 * 60 * 30;

        const char = allCharacters.find(c => c.id === msg.senderCharacterId);
        const nameColor = char ? (CLASS_COLORS[char.entityClass] ?? '#E8DCC8') : '#E8DCC8';

        return (
          <VStack key={msg.id} w="100%" spacing={0} alignItems="flex-start">
            {showTimestamp && (
              <Text color="#3A3228" fontSize="9px" py={0.5} w="100%" textAlign="center">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            )}
            <Box w="100%">
              <Text fontSize="xs" color="#E8DCC8">
                <Text
                  as={RouterLink}
                  color={nameColor}
                  fontWeight={700}
                  to={`${CHARACTERS_PATH}/${msg.senderCharacterId}`}
                  _hover={{ textDecoration: 'underline' }}
                  fontSize="xs"
                >
                  {msg.senderName}
                </Text>
                <Text as="span" color="#5A5347" mx={1}>:</Text>
                {msg.content}
              </Text>
            </Box>
          </VStack>
        );
      })}
      <Box ref={messagesEndRef} />
    </VStack>
  );
};

// ── Chat Input ──────────────────────────────────────────────────

const ChatInput: React.FC<{
  channel: string;
  isSending: boolean;
  onSend: (channel: string, content: string) => void;
  onFocusChange: (focused: boolean) => void;
}> = ({ channel, isSending, onSend, onFocusChange }) => {
  const [value, setValue] = useState('');

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop all keyboard events from reaching game controls
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isSending) {
        onSend(channel, value);
        setValue('');
      }
    }
    if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  }, [channel, isSending, onSend, value]);

  return (
    <HStack px={2} py={1.5} spacing={1.5}>
      <Input
        bg="#1A1610"
        border="1px solid #3A3228"
        borderRadius="sm"
        color="#E8DCC8"
        disabled={isSending}
        fontSize="xs"
        h="32px"
        maxLength={300}
        onBlur={() => onFocusChange(false)}
        onChange={e => setValue(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onKeyDown={handleKeyDown}
        placeholder="Say something..."
        size="xs"
        value={value}
        _placeholder={{ color: '#5A5347' }}
        _focus={{ borderColor: '#C87A2A', boxShadow: 'none' }}
      />
      <Box
        as="button"
        bg={value.trim() ? '#C87A2A' : '#3A3228'}
        borderRadius="sm"
        color="#E8DCC8"
        cursor={value.trim() ? 'pointer' : 'default'}
        display="flex"
        alignItems="center"
        justifyContent="center"
        h="32px"
        w="32px"
        minW="32px"
        opacity={value.trim() ? 1 : 0.4}
        onClick={() => {
          if (value.trim() && !isSending) {
            onSend(channel, value);
            setValue('');
          }
        }}
        transition="background 0.2s, opacity 0.2s"
        _hover={value.trim() ? { bg: '#D4A54A' } : {}}
      >
        <IoIosSend size={16} />
      </Box>
    </HStack>
  );
};
