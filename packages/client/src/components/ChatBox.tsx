import {
  Box,
  Button,
  CloseButton,
  HStack,
  ScaleFade,
  Text,
  Textarea,
  Tooltip,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef } from 'react';
import { IoIosSend, IoMdInformationCircleOutline } from 'react-icons/io';
import { IoChatbubble } from 'react-icons/io5';

import { useChat } from '../contexts/ChatContext';

export const ChatBox: React.FC = () => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const {
    messages,
    newMessage,
    onSendMesssage,
    onSetNewMessage,
    onSetMessageInputFocus,
  } = useChat();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isOpen: isChatBoxOpen,
    onOpen: onOpenChatBox,
    onClose: onCloseChatBox,
  } = useDisclosure();

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
    <>
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
          <VStack bg="grey300" flex="1" overflowY="auto" p={2} spacing={1}>
            {messages.map((message, index) => (
              <HStack
                justify={message.isMyMessage ? 'flex-end' : 'flex-start'}
                key={`message-${index}`}
                w="100%"
              >
                <Box
                  bg={message.isMyMessage ? 'blue' : 'white'}
                  borderRadius="md"
                  color={message.isMyMessage ? 'white' : 'black'}
                  maxW="70%"
                  p={2}
                  shadow="sm"
                >
                  <Text size="xs">{message.text}</Text>
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
              onClick={onSendMesssage}
              px={2}
              py={6}
              size="sm"
              variant="ghost"
            >
              <IoIosSend size={32} />
            </Button>
          </HStack>
        </Box>
      </ScaleFade>

      <ScaleFade initialScale={0.9} in={!isChatBoxOpen}>
        <Button
          position="absolute"
          bottom={0}
          right={0}
          onClick={onOpenChatBox}
          px={4}
          py={{ base: 5, lg: 6 }}
        >
          <IoChatbubble size={isDesktop ? 28 : 24} />
        </Button>
      </ScaleFade>
    </>
  );
};
