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
import { useCallback, useEffect, useRef, useState } from 'react';
import { CiCircleCheck } from 'react-icons/ci';
import { IoIosSend, IoMdInformationCircleOutline } from 'react-icons/io';
import { FaMedal } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

import { useChat } from '../contexts/ChatContext';
import { useMap } from '../contexts/MapContext';
import { shortenAddress } from '../utils/helpers';

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

  const [allCharacterOwners, setAllCharacterOwners] = useState<string>('');
  const [ensNameByAddressMapping, setEnsNameByAddressMapping] = useState<
    Record<string, string>
  >({});

  const [chatScrolledOnce, setChatScrolledOnce] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.maxHeight = '200px';
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const isInView = messagesEndRef.current
      ? messagesEndRef.current.getBoundingClientRect().top < window.innerHeight
      : false;

    if ((!chatScrolledOnce || isInView) && messagesEndRef.current) {
      setChatScrolledOnce(true);
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatScrolledOnce]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, newMessage]);

  useEffect(() => {
    if (isLoggedIn && isGroupMember && chatUser) {
      scrollToBottom();
    }
  }, [chatUser, isGroupMember, isLoggedIn, messages, scrollToBottom]);

  useEffect(() => {
    (async () => {
      if (!isLoggedIn) return;
      if (!isGroupMember) return;
      if (allCharacters.length === 0) return;

      const newCharacterOwners = JSON.stringify(
        allCharacters.map(character => character.owner).sort(),
      );

      if (newCharacterOwners === allCharacterOwners) return;
      try {
        const publicClient = createPublicClient({
          chain: mainnet,
          transport: http(),
        });

        const _ensNameByAddressMapping: Record<string, string> = {};

        const promises = allCharacters.map(async character => {
          if (!_ensNameByAddressMapping[character.owner]) {
            try {
              const ensName = await publicClient.getEnsName({
                address: character.owner as `0x${string}`,
                universalResolverAddress:
                  mainnet.contracts.ensUniversalResolver.address,
              });
              _ensNameByAddressMapping[character.owner] =
                ensName || shortenAddress(character.owner);
            } catch {
              // ENS reverse lookup fails for smart accounts / non-ENS addresses
              _ensNameByAddressMapping[character.owner] =
                shortenAddress(character.owner);
            }
          }
        });

        await Promise.all(promises);

        setAllCharacterOwners(newCharacterOwners);
        setEnsNameByAddressMapping(_ensNameByAddressMapping);
      } catch {
        // ENS resolution failed entirely — fall back silently
      }
    })();
  }, [allCharacters, allCharacterOwners, isGroupMember, isLoggedIn]);

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
        color="white"
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
              bg="#070D2A"
              hasArrow
              label="Adventurer Badge - Chat Unlocked!"
              placement="top"
              shouldWrapChildren
            >
              <Box color="gold">
                <FaMedal size={16} />
              </Box>
            </Tooltip>
          )}
          <Tooltip
            bg="#070D2A"
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
          <VStack bg="grey300" flex="1" overflowY="auto" p={2} spacing={2}>
            {messages.map((message, index) => {
              const isUser = message.from === chatUser.account;
              const messageCharacter = allCharacters.find(
                character =>
                  character.owner.toLowerCase() ===
                  message.from.toLowerCase(),
              );

              const characterAddressOrEns =
                ensNameByAddressMapping[message.from];

              // Only show timestamp if it's been more than 30 minutes since the last message
              const prevMessage = messages[index - 1];
              const showTimestamp =
                !prevMessage ||
                new Date(message.timestamp).getTime() -
                  new Date(prevMessage.timestamp).getTime() >
                  1000 * 60 * 30;

              if (message.jsx) {
                return (
                  <VStack key={`message-${index}`} mt={1} w="100%">
                    <Text size="2xs">
                      {new Date(message.timestamp).toLocaleString()}
                    </Text>
                    <Box
                      bgColor="blue500"
                      boxShadow="-10px -10px 8px 0px #A2A9B0, 10px 10px 8px 0px #54545480, 5px 5px 10px 0px #54545440, -5px -5px 4px 0px #5454547D"
                      color="white"
                      p={1}
                      w="100%"
                    >
                      {message.jsx}
                    </Box>
                  </VStack>
                );
              }

              return (
                <VStack key={`message-${index}`} w="100%">
                  {showTimestamp && (
                    <Text size="2xs">
                      {new Date(message.timestamp).toLocaleString()}
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
                          size="2xs"
                          to={`/characters/${messageCharacter.id}`}
                          _hover={{
                            color: 'blue',
                            textDecoration: 'underline',
                          }}
                        >
                          {`${messageCharacter.name} `}(
                          {characterAddressOrEns})
                        </Text>
                      )}
                      {!isUser && !messageCharacter && (
                        <Text size="2xs">{characterAddressOrEns}</Text>
                      )}
                      <HStack spacing={1}>
                        {message.delivered && isUser && (
                          <Box>
                            <CiCircleCheck color="blue" size={14} />
                          </Box>
                        )}
                        <Tooltip
                          bg="#070D2A"
                          hasArrow
                          label={`Sent: ${new Date(message.timestamp).toLocaleString()}`}
                          placement={isUser ? 'left' : 'right'}
                          shouldWrapChildren
                          fontSize="xs"
                        >
                          <Box
                            bg={isUser ? 'blue' : 'white'}
                            borderRadius="md"
                            color={isUser ? 'white' : 'black'}
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
