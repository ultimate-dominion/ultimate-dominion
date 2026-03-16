import {
  Box,
  Button,
  CloseButton,
  Heading,
  HStack,
  ScaleFade,
  Text,
  Textarea,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from 'react';
import { CiCircleCheck } from 'react-icons/ci';
import { IoIosSend, IoMdInformationCircleOutline } from 'react-icons/io';
import { FaMedal } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import { useChat } from '../contexts/ChatContext';
import { useMap } from '../contexts/MapContext';
import { shortenAddress } from '../utils/helpers';
import { CLASS_COLORS } from '../utils/types';

import { PolygonalCard } from './PolygonalCard';

type ChatBoxProps = { inline?: boolean };

export const ChatBox: React.FC<ChatBoxProps> = ({ inline = false }) => {
  const { allCharacters } = useMap();
  const {
    chatUser,
    hasBadge,
    isCheckingBadge,
    isGroupMember,
    isJoiningGroupChat,
    isLoggedIn,
    isLoggingIn,
    isSending,
    isOpen: isChatBoxOpen,
    messages,
    newMessage,
    onClose: onCloseChatBox,
    onJoinGroupChat,
    onLogin,
    onSendMessage,
    onSetNewMessage,
    onSetMessageInputFocus,
  } = useChat();

  // Badge gating — disabled for beta, re-enable by setting VITE_BADGE_CONTRACT_ADDRESS
  const badgeGatingEnabled = false; // TODO: restore after beta: !!import.meta.env.VITE_BADGE_CONTRACT_ADDRESS
  const canAccessChat = !badgeGatingEnabled || hasBadge;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.maxHeight = '200px';
    }
  }, []);

  const scrollToBottom = useCallback(() => {}, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, newMessage]);

  useEffect(() => {
    if (isLoggedIn && isGroupMember && chatUser) {
      scrollToBottom();
    }
  }, [chatUser, isGroupMember, isLoggedIn, messages, scrollToBottom]);

  const isVisible = inline || isChatBoxOpen;

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
        <HStack>
          <Heading size={inline ? 'sm' : { base: 'sm', md: 'md' }}>Chat</Heading>
          {hasBadge && (
            <Tooltip
              bg="#14120F"
              hasArrow
              label="Adventurer Badge - Chat Unlocked!"
              placement="top"
              shouldWrapChildren
            >
              <Box color="#EFD31C">
                <FaMedal size={16} />
              </Box>
            </Tooltip>
          )}
          <Tooltip
            bg="#14120F"
            hasArrow
            label="This chat is permanent and public to all other players. Do not share personal information or sensitive data."
            placement="top"
            shouldWrapChildren
          >
            <IoMdInformationCircleOutline />
          </Tooltip>
        </HStack>
        {!inline && <CloseButton onClick={onCloseChatBox} />}
      </HStack>
      <Box
        flex={inline ? 1 : undefined}
        minH={inline ? 0 : undefined}
        h={inline ? undefined : isVisible ? { base: '200px', sm: '250px', lg: '300px' } : '0'}
        overflowY="auto"
        transition={inline ? undefined : 'height 0.3s ease'}
      >
        {/* Badge gating message */}
        {badgeGatingEnabled && !canAccessChat && !isCheckingBadge && (
          <VStack justifyContent="center" mt={8} p={2} spacing={4}>
            <Text size="sm" textAlign="center" fontWeight="bold">
              Chat Locked
            </Text>
            <Text size="sm" textAlign="center">
              Reach level 3 to unlock global chat and earn your Adventurer badge!
            </Text>
            <Text size="xs" textAlign="center" color="gray.500">
              Keep adventuring and defeating monsters to level up.
            </Text>
          </VStack>
        )}
        {/* Checking badge status */}
        {badgeGatingEnabled && isCheckingBadge && (
          <VStack justifyContent="center" mt={8} p={2} spacing={4}>
            <Text size="sm" textAlign="center">
              Checking chat access...
            </Text>
          </VStack>
        )}
        {/* Login/Join flow - only show if badge gating passes */}
        {canAccessChat && (isLoggingIn || !isGroupMember) && (
          <VStack justifyContent="center" mt={inline ? 4 : 8} p={2} spacing={inline ? 4 : 8}>
            <Text size="sm" textAlign="center">
              Ultimate Dominion&apos;s chat is public and permanent. Do not
              share personal information or sensitive data.
            </Text>
            {isLoggedIn ? (
              <Button
                isLoading={isJoiningGroupChat}
                onClick={onJoinGroupChat}
                size="sm"
              >
                Join Chat
              </Button>
            ) : (
              <Button isLoading={isLoggingIn} onClick={onLogin} size="sm">
                Login
              </Button>
            )}
          </VStack>
        )}
        {canAccessChat && isLoggedIn && isGroupMember && chatUser && (
          <VStack bg="#14120F" className="data-dense" flex="1" overflowY="auto" p={2} spacing={2}>
            {messages.map((message, index) => {
              const isUser = message.from === chatUser.account;
              const messageCharacter = allCharacters.find(
                character =>
                  character.owner.toLowerCase() ===
                  message.from.toLowerCase(),
              );

              // Only show timestamp if it's been more than 30 minutes since the last message
              const prevMessage = messages[index - 1];
              const showTimestamp =
                !prevMessage ||
                new Date(message.timestamp).getTime() -
                  new Date(prevMessage.timestamp).getTime() >
                  1000 * 60 * 30;

              // Announcement cards (JSX messages like rare drops, marketplace sales)
              if (message.jsx) {
                return (
                  <VStack key={`message-${index}`} mt={1} w="100%">
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
                      {message.jsx}
                    </Box>
                  </VStack>
                );
              }

              const nameColor = messageCharacter
                ? CLASS_COLORS[messageCharacter.entityClass] ?? '#E8DCC8'
                : '#E8DCC8';

              return (
                <VStack key={`message-${index}`} w="100%">
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
                  <HStack
                    justify={isUser ? 'flex-end' : 'flex-start'}
                    w="100%"
                  >
                    <VStack
                      alignItems={isUser ? 'flex-end' : 'flex-start'}
                      maxW="70%"
                      spacing={1}
                    >
                      {!isUser && messageCharacter && (
                        <Text
                          as={Link}
                          color={nameColor}
                          size="2xs"
                          to={`/characters/${messageCharacter.id}`}
                          _hover={{
                            textDecoration: 'underline',
                          }}
                        >
                          {messageCharacter.name}
                        </Text>
                      )}
                      {!isUser && !messageCharacter && (
                        <Text color="#5A5347" size="2xs">
                          {shortenAddress(message.from)}
                        </Text>
                      )}
                      <HStack spacing={1}>
                        {message.delivered && isUser && (
                          <Box>
                            <CiCircleCheck color="#C87A2A" size={14} />
                          </Box>
                        )}
                        <Tooltip
                          bg="#14120F"
                          hasArrow
                          label={`Sent: ${new Date(message.timestamp).toLocaleString()}`}
                          placement={isUser ? 'left' : 'right'}
                          shouldWrapChildren
                          fontSize="xs"
                        >
                          <Box
                            bg={isUser ? '#C87A2A' : '#1C1814'}
                            borderRadius="md"
                            color="#E8DCC8"
                            cursor="pointer"
                            p={2}
                            shadow="sm"
                          >
                            <Text size="xs">{message.message}</Text>
                          </Box>
                        </Tooltip>
                      </HStack>
                    </VStack>
                  </HStack>
                </VStack>
              );
            })}
            <Box ref={messagesEndRef} />
          </VStack>
        )}
      </Box>
      {canAccessChat && isLoggedIn && isGroupMember && chatUser && isVisible && (
        <HStack alignItems="center" pr={2}>
          <Textarea
            h="auto"
            isDisabled={isSending}
            maxH="50px"
            minH="40px"
            onChange={e => onSetNewMessage(e.target.value)}
            overflow="hidden"
            placeholder="Type a message..."
            ref={textareaRef}
            resize="none"
            size="xs"
            value={newMessage}
            onFocus={() => onSetMessageInputFocus(true)}
            onBlur={() => onSetMessageInputFocus(false)}
          />
          <Button
            isDisabled={!newMessage || isSending}
            isLoading={isSending}
            onClick={onSendMessage}
            px={2}
            py={4}
            size="sm"
            variant="blue"
          >
            <IoIosSend size={32} />
          </Button>
        </HStack>
      )}
    </PolygonalCard>
  );

  if (inline) return content;

  return (
    <ScaleFade initialScale={0.9} in={isChatBoxOpen}>
      {content}
    </ScaleFade>
  );
};
