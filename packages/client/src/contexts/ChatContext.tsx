import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const OTHER_MESSAGES = [
  {
    text: 'This is dummy text. Is anyone there?',
    isMyMessage: false,
  },
  {
    text: 'Helllooooo???',
    isMyMessage: false,
  },
];

type ChatMessage = {
  text: string;
  isMyMessage?: boolean;
};

type ChatContextType = {
  isMessageInputFocused: boolean;
  messages: ChatMessage[];
  newMessage: string;
  onSendMesssage: () => void;
  onSetNewMessage: (message: string) => void;
  onSetMessageInputFocus: (isFocused: boolean) => void;
};

const ChatContext = createContext<ChatContextType>({
  isMessageInputFocused: false,
  messages: [],
  newMessage: '',
  onSendMesssage: () => {},
  onSetNewMessage: () => {},
  onSetMessageInputFocus: () => {},
});

export type ChatProviderProps = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps): JSX.Element => {
  const [messages, setMessages] = useState<ChatMessage[]>(OTHER_MESSAGES);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);

  const onSetMessageInputFocus = useCallback((isFocused: boolean) => {
    setIsMessageInputFocused(isFocused);
  }, []);

  const onSetNewMessage = useCallback((message: string) => {
    setNewMessage(message);
  }, []);

  const onSendMesssage = useCallback(() => {
    if (newMessage.trim()) {
      setMessages([...messages, { text: newMessage, isMyMessage: true }]);
      setNewMessage('');
    }
  }, [messages, newMessage]);

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
    <ChatContext.Provider
      value={{
        isMessageInputFocused,
        messages,
        newMessage,
        onSendMesssage,
        onSetNewMessage,
        onSetMessageInputFocus,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => useContext(ChatContext);
