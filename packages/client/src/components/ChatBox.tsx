import {
  Box,
  Button,
  CloseButton,
  HStack,
  ScaleFade,
  Spinner,
  Text,
  Textarea,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from 'react';
import { CiCircleCheck } from 'react-icons/ci';
import { IoIosSend, IoMdInformationCircleOutline } from 'react-icons/io';

import { useChat } from '../contexts/ChatContext';
import { shortenAddress } from '../utils/helpers';

export const ChatBox: React.FC = () => {
  const {
    chatUser,
    isGroupMember,
    isInitializing,
    isJoiningGroupChat,
    isSending,
    isOpen: isChatBoxOpen,
    messages,
    newMessage,
    onClose: onCloseChatBox,
    onJoinGroupChat,
    onSendMessage,
    onSetNewMessage,
    onSetMessageInputFocus,
  } = useChat();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.maxHeight = '200px';
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, newMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages]);

  return (
    <ScaleFade initialScale={0.9} in={isChatBoxOpen}>
      <Box
        bg="white"
        border="2px black solid"
        display="flex"
        flexDirection="column"
        h={isChatBoxOpen ? '350px' : '0'}
        p={2}
        transition="height 0.3s ease"
        w={{ base: '100%', sm: '350px' }}
      >
        <VStack alignItems="flex-start" mb={2} spacing={2}>
          <HStack justify="space-between" w="100%">
            <HStack>
              <Text fontSize="lg">Chat</Text>
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
            <CloseButton onClick={onCloseChatBox} />
          </HStack>
        </VStack>
        {isInitializing && (
          <VStack h="100%" justifyContent="center">
            <Spinner mb={12} size="lg" />
          </VStack>
        )}
        {!isInitializing && !isGroupMember && (
          <VStack justifyContent="center" mt={8} spacing={8}>
            <Text size="sm" textAlign="center">
              Ultimate Dominion&apos;s chat is public and permanent. Do not
              share personal information or sensitive data.
            </Text>
            <Button
              isLoading={isJoiningGroupChat}
              onClick={onJoinGroupChat}
              size="sm"
            >
              Join Chat
            </Button>
          </VStack>
        )}
        {!isInitializing && isGroupMember && chatUser && (
          <>
            <VStack bg="grey300" flex="1" overflowY="auto" p={2} spacing={2}>
              {messages.map((message, index) => {
                const isUser = message.from === chatUser.account;

                // Only show timestamp if it's been more than 30 minutes since the last message
                const prevMessage = messages[index - 1];
                const showTimestamp =
                  !prevMessage ||
                  new Date(message.timestamp).getTime() -
                    new Date(prevMessage.timestamp).getTime() >
                    1000 * 60 * 30;

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
                        {!isUser && (
                          <Text size="2xs">{shortenAddress(message.from)}</Text>
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

            <HStack alignItems="center" mt={4}>
              <Textarea
                h="auto"
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
                py={6}
                size="sm"
                variant="ghost"
              >
                <IoIosSend size={32} />
              </Button>
            </HStack>
          </>
        )}
      </Box>
    </ScaleFade>
  );
};
