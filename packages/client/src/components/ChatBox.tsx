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
import { IoIosSend, IoMdInformationCircleOutline } from 'react-icons/io';

import { useChat } from '../contexts/ChatContext';

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
        w={{ base: '100%', lg: '350px' }}
      >
        <VStack alignItems="flex-start" mb={2} spacing={2}>
          <HStack justify="space-between" w="100%">
            <HStack>
              <Text fontSize="lg">Chat</Text>
              <Tooltip
                bg="black"
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
            <VStack bg="grey300" flex="1" overflowY="auto" p={2} spacing={1}>
              {messages.map((message, index) => (
                <HStack
                  justify={
                    message.from === chatUser.account
                      ? 'flex-end'
                      : 'flex-start'
                  }
                  key={`message-${index}`}
                  w="100%"
                >
                  <Box
                    bg={message.from === chatUser.account ? 'blue' : 'white'}
                    borderRadius="md"
                    color={
                      message.from === chatUser.account ? 'white' : 'black'
                    }
                    maxW="70%"
                    p={2}
                    shadow="sm"
                  >
                    <Text size="xs">{message.message}</Text>
                  </Box>
                </HStack>
              ))}
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
