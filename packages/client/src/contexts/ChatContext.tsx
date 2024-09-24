import { useDisclosure } from '@chakra-ui/react';
import { transportObserver } from '@latticexyz/common';
import {
  CONSTANTS,
  GroupDTO,
  MessageEvent,
  MessageEventType,
  PushAPI,
} from '@pushprotocol/restapi';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { createWalletClient, fallback, Hex, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useChains } from 'wagmi';

import { useToast } from '../hooks/useToast';
import { IS_CHAT_BOX_OPEN_KEY } from '../utils/constants';

const USER_WALLET_KEY = 'ud-push-poc-user-wallet-key';
const GROUP_CHAT_ID =
  '7699bfa8e5309b876a7b60e75074ecdf41d029575f3655a33f2b449e7730dfa4';

type Message = {
  from: string;
  message: string;
  timestamp: number;
};

type ChatContextType = {
  chatUser: PushAPI | null;
  isGroupMember: boolean;
  isInitializing: boolean;
  isJoiningGroupChat: boolean;
  isMessageInputFocused: boolean;
  isOpen: boolean;
  isSending: boolean;
  messages: Message[];
  newMessage: string;
  onClose: () => void;
  onJoinGroupChat: () => void;
  onOpen: () => void;
  onSendMessage: () => void;
  onSetNewMessage: (message: string) => void;
  onSetMessageInputFocus: (isFocused: boolean) => void;
};

const ChatContext = createContext<ChatContextType>({
  chatUser: null,
  isGroupMember: false,
  isInitializing: true,
  isJoiningGroupChat: false,
  isMessageInputFocused: false,
  isOpen: false,
  isSending: false,
  messages: [],
  newMessage: '',
  onClose: () => {},
  onJoinGroupChat: () => {},
  onOpen: () => {},
  onSendMessage: () => {},
  onSetNewMessage: () => {},
  onSetMessageInputFocus: () => {},
});

export type ChatProviderProps = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const chains = useChains();

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [user, setUser] = useState<PushAPI | null>(null);

  const [isGroupMember, setIsGroupMember] = useState<boolean>(false);
  const [isJoiningGroupChat, setIsJoiningGroupChat] = useState<boolean>(false);

  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        if (!isOpen) return;
        if (user) return;

        if (!GROUP_CHAT_ID) {
          throw new Error('Group chat ID is missing');
        }

        let userPrivateKey = localStorage.getItem(USER_WALLET_KEY) ?? '';

        if (!userPrivateKey) {
          userPrivateKey = generatePrivateKey();
          localStorage.setItem(USER_WALLET_KEY, userPrivateKey);
        }

        const userAccount = privateKeyToAccount(userPrivateKey as Hex);

        const walletClient = createWalletClient({
          account: userAccount,
          chain: chains[0],
          transport: transportObserver(fallback([http()])),
        });

        const _user = await PushAPI.initialize(walletClient, {
          env: CONSTANTS.ENV.STAGING,
        });

        const groupChatInfo = (await _user.chat.group.info(
          GROUP_CHAT_ID,
        )) as GroupDTO;
        const groupChatMembers = groupChatInfo.members.map(
          member => member.wallet.split(':')[1],
        );

        if (!groupChatMembers.includes(_user.account)) {
          setIsGroupMember(false);
        } else {
          setIsGroupMember(true);
        }

        const chatHistory = await _user.chat.history(GROUP_CHAT_ID);

        const _userMessages = chatHistory.map(message => ({
          from: message.fromDID.split(':')[1],
          message: message.messageContent,
          timestamp: Number(message.timestamp),
        }));

        setMessages(_userMessages.reverse());
        setUser(_user);

        const stream = await _user.initStream([CONSTANTS.STREAM.CHAT], {
          filter: {
            chats: [GROUP_CHAT_ID],
          },
        });

        stream.on(CONSTANTS.STREAM.CHAT, (message: MessageEvent) => {
          if (message.event.split('.')[1] === MessageEventType.Message) {
            setMessages(prevMessages => [
              ...prevMessages,
              {
                from: message.from.split(':')[1],
                message: message.message.content,
                timestamp: Number(message.timestamp),
              },
            ]);
          }
        });

        stream.connect();
        setIsInitializing(false);
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to initialize chat.', e);
      }
    })();
  }, [chains, isOpen, renderError, user]);

  const onSetMessageInputFocus = useCallback((isFocused: boolean) => {
    setIsMessageInputFocused(isFocused);
  }, []);

  const onSetNewMessage = useCallback((message: string) => {
    setNewMessage(message);
  }, []);

  const onSendMessage = useCallback(async () => {
    try {
      setIsSending(true);

      if (!user) {
        throw new Error('Failed to initialize user');
      }

      if (!newMessage) {
        throw new Error('Message input is empty');
      }

      await user.chat.send(GROUP_CHAT_ID, {
        content: newMessage,
        type: 'Text',
      });
      setNewMessage('');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to send message.', e);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, renderError, user]);

  const onJoinGroupChat = useCallback(async () => {
    try {
      setIsJoiningGroupChat(true);

      if (!user) {
        throw new Error('Failed to initialize user');
      }

      const groupChatInfo = (await user.chat.group.info(
        GROUP_CHAT_ID,
      )) as GroupDTO;
      const groupChatMembers = groupChatInfo.members.map(
        member => member.wallet.split(':')[1],
      );

      if (groupChatMembers.includes(user.account)) {
        throw new Error('User is already a member of the group chat.');
      }

      await user.chat.group.join(GROUP_CHAT_ID);
      setIsGroupMember(true);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to join group chat.', e);
    } finally {
      setIsJoiningGroupChat(false);
    }
  }, [renderError, user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (!isMessageInputFocused) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMessageInputFocused, isOpen, onSendMessage]);

  const onCloseAndClear = useCallback(() => {
    onClose();
    localStorage.removeItem(IS_CHAT_BOX_OPEN_KEY);
  }, [onClose]);

  const onOpenAndSet = useCallback(() => {
    onOpen();
    localStorage.setItem(IS_CHAT_BOX_OPEN_KEY, 'true');
  }, [onOpen]);

  return (
    <ChatContext.Provider
      value={{
        chatUser: user,
        isGroupMember,
        isInitializing,
        isJoiningGroupChat,
        isMessageInputFocused,
        isOpen,
        isSending,
        messages,
        newMessage,
        onClose: onCloseAndClear,
        onJoinGroupChat,
        onOpen: onOpenAndSet,
        onSendMessage,
        onSetNewMessage,
        onSetMessageInputFocus,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => useContext(ChatContext);
