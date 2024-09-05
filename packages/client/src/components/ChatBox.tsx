import { Box, Button, HStack, Text, Textarea, VStack } from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IoIosSend } from 'react-icons/io';

type ChatMessage = {
  text: string;
  isMyMessage?: boolean;
};

export const OTHER_MESSAGES = [
  {
    text: 'This is dummy text. Is anyone there?',
    isMyMessage: false,
  },
  {
    text: 'Helllooooo???',
    isMyMessage: false,
  },
];

export const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(OTHER_MESSAGES);
  const [newMessage, setNewMessage] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const onSendMesssage = useCallback(() => {
    if (newMessage.trim()) {
      setMessages([...messages, { text: newMessage, isMyMessage: true }]);
      setNewMessage('');
    }
  }, [messages, newMessage]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSendMesssage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSendMesssage]);

  return (
    <Box display="flex" flexDirection="column" h="100%" p={2} w="100%">
      <VStack bg="grey300" overflowY="auto" flex="1" p={2} spacing={1}>
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
          minH="40px"
          maxH="50px"
          onChange={e => setNewMessage(e.target.value)}
          overflow="hidden"
          placeholder="Type a message..."
          ref={textareaRef}
          resize="none"
          size="xs"
          value={newMessage}
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
  );
};
