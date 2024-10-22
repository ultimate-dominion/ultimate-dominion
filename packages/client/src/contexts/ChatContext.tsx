import { Text, useDisclosure } from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import { getComponentValueStrict, Has } from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
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
  useMemo,
  useState,
} from 'react';
import { zeroAddress } from 'viem';
import { useWalletClient } from 'wagmi';

import { useToast } from '../hooks/useToast';
import { IS_CHAT_BOX_OPEN_KEY } from '../utils/constants';
import { decodeMobInstanceId, startsWithVowel } from '../utils/helpers';
import { Character, MonsterTemplate } from '../utils/types';
import { useItems } from './ItemsContext';
import { useMap } from './MapContext';
import { useMonsters } from './MonstersContext';
import { useMUD } from './MUDContext';

const GROUP_CHAT_ID =
  '7699bfa8e5309b876a7b60e75074ecdf41d029575f3655a33f2b449e7730dfa4';

type Message = {
  delivered: boolean;
  from: string;
  jsx?: JSX.Element;
  message: string;
  timestamp: number;
};

type ChatContextType = {
  chatUser: PushAPI | null;
  isGroupMember: boolean;
  isJoiningGroupChat: boolean;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  isMessageInputFocused: boolean;
  isOpen: boolean;
  isSending: boolean;
  messages: Message[];
  newMessage: string;
  onClose: () => void;
  onJoinGroupChat: () => void;
  onLogin: () => void;
  onOpen: () => void;
  onSendMessage: () => void;
  onSetNewMessage: (message: string) => void;
  onSetMessageInputFocus: (isFocused: boolean) => void;
};

const ChatContext = createContext<ChatContextType>({
  chatUser: null,
  isGroupMember: false,
  isJoiningGroupChat: false,
  isLoggedIn: false,
  isLoggingIn: true,
  isMessageInputFocused: false,
  isOpen: false,
  isSending: false,
  messages: [],
  newMessage: '',
  onClose: () => {},
  onJoinGroupChat: () => {},
  onLogin: () => {},
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
  const { data } = useWalletClient();
  const {
    components: { CombatEncounter, CombatOutcome, MarketplaceSale, ShopSale },
  } = useMUD();
  const { armorTemplates, spellTemplates, weaponTemplates } = useItems();
  const { monsterTemplates } = useMonsters();
  const { allCharacters } = useMap();

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [user, setUser] = useState<PushAPI | null>(null);

  const [isGroupMember, setIsGroupMember] = useState<boolean>(false);
  const [isJoiningGroupChat, setIsJoiningGroupChat] = useState<boolean>(false);

  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const allBattleOutcomes: Message[] = useEntityQuery([Has(CombatOutcome)]).map(
    entity => {
      const combatOutcome = getComponentValueStrict(CombatOutcome, entity);
      const encounter = getComponentValueStrict(CombatEncounter, entity);

      const attackerId = encounter.attackers[0];
      const defenderId = encounter.defenders[0];

      let attacker: Character | MonsterTemplate | undefined =
        allCharacters.find(character => character.id === attackerId);

      if (!attacker) {
        const decodedMonster = decodeMobInstanceId(attackerId as `0x${string}`);
        attacker = monsterTemplates.find(
          monster => monster.mobId === decodedMonster.mobId,
        );
      }

      let defender: Character | MonsterTemplate | undefined =
        allCharacters.find(character => character.id === defenderId);

      if (!defender) {
        const decodedMonster = decodeMobInstanceId(defenderId as `0x${string}`);
        defender = monsterTemplates.find(
          monster => monster.mobId === decodedMonster.mobId,
        );
      }

      const winner = combatOutcome.attackersWin ? attacker : defender;
      const loser = combatOutcome.attackersWin ? defender : attacker;

      const { itemsDropped } = combatOutcome;

      const allItems = [...spellTemplates, ...weaponTemplates];

      const firstDroppedItemName = itemsDropped.map(itemId => {
        const item = allItems.find(item => item.tokenId === itemId.toString());
        return item ? item.name : null;
      })[0];

      const article = startsWithVowel(firstDroppedItemName ?? '') ? 'an' : 'a';

      return {
        delivered: true,
        from: zeroAddress,
        jsx: winner && loser && (
          <Text fontWeight={500} size="xs" textAlign="center">
            {winner.name} defeated {loser.name}!{' '}
            {firstDroppedItemName && (
              <Text as="span" color="green.500">
                {winner.name} gained {article} {firstDroppedItemName}!
              </Text>
            )}
          </Text>
        ),
        message: '',
        timestamp: Number(combatOutcome.endTime) * 1000,
      };
    },
  );

  const allShopSales: Message[] = useEntityQuery([Has(ShopSale)]).map(
    entity => {
      const shopSale = getComponentValueStrict(ShopSale, entity);

      const { buying } = shopSale;

      const { customerId, itemId, timestamp } = decodeEntity(
        {
          shopId: 'bytes32',
          customerId: 'bytes32',
          itemId: 'uint256',
          timestamp: 'uint256',
        },
        entity,
      );

      const allItems = [
        ...armorTemplates,
        ...spellTemplates,
        ...weaponTemplates,
      ];

      const customerName =
        allCharacters.find(character => character.id === customerId)?.name ??
        null;

      const itemName =
        allItems.find(item => item.tokenId === itemId.toString())?.name ?? null;

      const article = startsWithVowel(itemName ?? '') ? 'an' : 'a';

      return {
        delivered: true,
        from: zeroAddress,
        jsx:
          customerName && itemName ? (
            <Text fontWeight={500} size="xs" textAlign="center">
              {customerName} {buying ? 'bought' : 'sold'} {article} {itemName}{' '}
              in a shop!
            </Text>
          ) : undefined,
        message: '',
        timestamp: Number(timestamp) * 1000,
      };
    },
  );

  const allMarketplaceSales: Message[] = useEntityQuery([
    Has(MarketplaceSale),
  ]).map(entity => {
    const marketplaceSale = getComponentValueStrict(MarketplaceSale, entity);

    const { buyer, itemId, timestamp } = marketplaceSale;

    const allItems = [...armorTemplates, ...spellTemplates, ...weaponTemplates];

    const customerName =
      allCharacters.find(character => character.owner === buyer)?.name ?? null;

    const itemName =
      allItems.find(item => item.tokenId === itemId.toString())?.name ?? null;

    const article = startsWithVowel(itemName ?? '') ? 'an' : 'a';

    return {
      delivered: true,
      from: zeroAddress,
      jsx:
        customerName && itemName ? (
          <Text fontWeight={500} size="xs" textAlign="center">
            {customerName} bought {article} {itemName} in the Marketplace!
          </Text>
        ) : undefined,
      message: '',
      timestamp: Number(timestamp) * 1000,
    };
  });

  const messagesAndEvents = useMemo(() => {
    return [
      ...messages,
      ...allBattleOutcomes,
      ...allMarketplaceSales,
      ...allShopSales,
    ].sort((a, b) => a.timestamp - b.timestamp);
  }, [allBattleOutcomes, allMarketplaceSales, allShopSales, messages]);

  const onLogin = useCallback(async () => {
    try {
      if (!isOpen) return;
      if (user) return;
      if (!data) return;

      if (!GROUP_CHAT_ID) {
        throw new Error('Group chat ID is missing');
      }

      setIsLoggingIn(true);

      const _user = await PushAPI.initialize(data, {
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
        delivered: true,
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
          // Update delivered status of the last message sent by the user
          const from = message.from.split(':')[1];
          if (from === _user.account) {
            setMessages(prevMessages => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (
                lastMessage &&
                lastMessage.from === _user.account &&
                !lastMessage.delivered
              ) {
                return prevMessages.slice(0, -1).concat({
                  ...lastMessage,
                  delivered: true,
                });
              }
              return prevMessages;
            });
          } else {
            setMessages(prevMessages => [
              ...prevMessages,
              {
                delivered: true,
                from,
                message: message.message.content,
                timestamp: Number(message.timestamp),
              },
            ]);
          }
        }
      });

      stream.connect();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to initialize chat.', e);
    } finally {
      setIsLoggingIn(false);
    }
  }, [data, isOpen, renderError, user]);

  const onJoinGroupChat = useCallback(async () => {
    try {
      setIsJoiningGroupChat(true);

      if (!user) {
        throw new Error('Failed to join group.');
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

  const onSetMessageInputFocus = useCallback((isFocused: boolean) => {
    setIsMessageInputFocused(isFocused);
  }, []);

  const onSetNewMessage = useCallback((message: string) => {
    setNewMessage(message);
  }, []);

  const onSendMessage = useCallback(async () => {
    const oldMessage = newMessage;

    try {
      setIsSending(true);

      if (!user) {
        throw new Error('Failed to initialize user');
      }

      if (!newMessage) {
        throw new Error('Message input is empty');
      }

      // Optimistically add the message to the chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          delivered: false,
          from: user.account,
          message: newMessage,
          timestamp: Date.now(),
        },
      ]);

      setNewMessage('');
      setIsSending(false);

      await user.chat.send(GROUP_CHAT_ID, {
        content: newMessage,
        type: 'Text',
      });
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to send message.', e);
      setNewMessage(oldMessage);
    }
  }, [newMessage, renderError, user]);

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
    localStorage.setItem(IS_CHAT_BOX_OPEN_KEY, 'false');
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
        isJoiningGroupChat,
        isLoggedIn: !!user,
        isLoggingIn,
        isMessageInputFocused,
        isOpen,
        isSending,
        messages: messagesAndEvents,
        newMessage,
        onClose: onCloseAndClear,
        onJoinGroupChat,
        onLogin,
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
