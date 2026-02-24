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
  useRef,
  useState,
} from 'react';
import { zeroAddress, erc721Abi } from 'viem';
import { usePublicClient } from 'wagmi';

import { useToast } from '../hooks/useToast';
import { IS_CHAT_BOX_OPEN_KEY } from '../utils/constants';
import { decodeMobInstanceId, startsWithVowel } from '../utils/helpers';
import { Character, MonsterTemplate } from '../utils/types';

import { useAuth } from './AuthContext';
import { useCharacter } from './CharacterContext';
import { useItems } from './ItemsContext';
import { useMap } from './MapContext';
import { useMonsters } from './MonstersContext';
import { useMUD } from './MUDContext';

// TODO: Update these after deploying badges and creating new group
const GROUP_CHAT_ID =
  '20ca5a940d23fae1191bcf39a7f02cafd02d5427b7f6aa8a1b882c8641239475';

// Badge contract address - set after deployment
// Get from UltimateDominion.getBadgeToken() or worlds.json deployment
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';

// Adventurer badge token ID base (actual ID = 1_000_000 + characterTokenId)
const ADVENTURER_BADGE_BASE = 1;

type Message = {
  delivered: boolean;
  from: string;
  jsx?: JSX.Element;
  message: string;
  timestamp: number;
};

type ChatContextType = {
  chatUser: PushAPI | null;
  hasBadge: boolean;
  isCheckingBadge: boolean;
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
  hasBadge: false,
  isCheckingBadge: false,
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
  const {
    authMethod,
    embeddedWalletClient,
    externalWalletClient,
    ownerAddress: address,
  } = useAuth();
  const publicClient = usePublicClient();
  // Use the appropriate wallet client for Push Protocol
  const data = authMethod === 'embedded' ? embeddedWalletClient : externalWalletClient;
  const {
    components: { CombatEncounter, CombatOutcome, MarketplaceSale, ShopSale },
  } = useMUD();
  const {
    armorTemplates,
    consumableTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { monsterTemplates } = useMonsters();
  const { allCharacters } = useMap();
  const { character: currentCharacter } = useCharacter();

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [user, setUser] = useState<PushAPI | null>(null);

  const [isGroupMember, setIsGroupMember] = useState<boolean>(false);
  const [isJoiningGroupChat, setIsJoiningGroupChat] = useState<boolean>(false);

  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Push Protocol stream ref for cleanup
  const streamRef = useRef<Awaited<ReturnType<PushAPI['initStream']>> | null>(null);

  // Badge checking state
  const [hasBadge, setHasBadge] = useState<boolean>(false);
  const [isCheckingBadge, setIsCheckingBadge] = useState<boolean>(false);

  // Check if user has Adventurer badge
  useEffect(() => {
    const checkBadge = async () => {
      if (!address || !publicClient || !BADGE_CONTRACT_ADDRESS) {
        setHasBadge(false);
        return;
      }

      setIsCheckingBadge(true);
      try {
        // Get character token ID from currentCharacter
        const characterTokenId = currentCharacter?.tokenId;
        if (!characterTokenId) {
          setHasBadge(false);
          return;
        }

        // Calculate badge token ID: ADVENTURER_BADGE_BASE * 1_000_000 + characterTokenId
        const badgeTokenId = BigInt(ADVENTURER_BADGE_BASE) * BigInt(1_000_000) + BigInt(characterTokenId);
        // Check if user owns this badge
        const owner = await publicClient.readContract({
          address: BADGE_CONTRACT_ADDRESS as `0x${string}`,
          abi: erc721Abi,
          functionName: 'ownerOf',
          args: [badgeTokenId],
        });

        setHasBadge(owner === address);
      } catch (error) {
        // Badge doesn't exist or other error - user doesn't have badge
        setHasBadge(false);
      } finally {
        setIsCheckingBadge(false);
      }
    };

    checkBadge();
    // Re-check when level changes (badge is minted at level 3)
  }, [address, publicClient, currentCharacter?.tokenId, currentCharacter?.level]);

  const battleOutcomeEntities = useEntityQuery([Has(CombatOutcome)]);
  const allBattleOutcomes: Message[] = useMemo(() => battleOutcomeEntities
    .map(entity => {
      const combatOutcome = getComponentValueStrict(CombatOutcome, entity);
      const encounter = getComponentValueStrict(CombatEncounter, entity);

      const attackerId = encounter.attackers[0];
      const defenderId = encounter.defenders[0];

      // Only show battles involving the current character
      if (
        currentCharacter &&
        attackerId !== currentCharacter.id &&
        defenderId !== currentCharacter.id
      ) {
        return null;
      }

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

      const droppedItemNames = itemsDropped
        .map(itemId => {
          const item = allItems.find(item => item.tokenId === itemId.toString());
          return item ? item.name : null;
        })
        .filter(Boolean);

      const firstDroppedItemName = droppedItemNames[0];
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
    })
    .filter((m): m is Message => m !== null),
  [battleOutcomeEntities, currentCharacter, allCharacters, monsterTemplates, spellTemplates, weaponTemplates]);

  const shopSaleEntities = useEntityQuery([Has(ShopSale)]);
  const allShopSales: Message[] = useMemo(() => shopSaleEntities.map(
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
        ...consumableTemplates,
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
  ), [shopSaleEntities, allCharacters, armorTemplates, consumableTemplates, spellTemplates, weaponTemplates]);

  const marketplaceSaleEntities = useEntityQuery([Has(MarketplaceSale)]);
  const allMarketplaceSales: Message[] = useMemo(() => marketplaceSaleEntities.map(entity => {
    const marketplaceSale = getComponentValueStrict(MarketplaceSale, entity);

    const { buyer, itemId, timestamp } = marketplaceSale;

    const allItems = [
      ...armorTemplates,
      ...consumableTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ];

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
  }), [marketplaceSaleEntities, allCharacters, armorTemplates, consumableTemplates, spellTemplates, weaponTemplates]);

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
      streamRef.current = stream;
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to initialize chat.', e);
    } finally {
      setIsLoggingIn(false);
    }
  }, [data, isOpen, renderError, user]);

  // Cleanup Push Protocol stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.disconnect();
        streamRef.current = null;
      }
    };
  }, []);

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
    const oldMessage = newMessage.trim();

    if (!oldMessage) {
      return;
    }

    try {
      setIsSending(true);

      if (!user) {
        throw new Error('Failed to initialize user');
      }

      // Optimistically add the message to the chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          delivered: false,
          from: user.account,
          message: oldMessage,
          timestamp: Date.now(),
        },
      ]);

      setNewMessage('');
      setIsSending(false);

      await user.chat.send(GROUP_CHAT_ID, {
        content: oldMessage,
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
        hasBadge,
        isCheckingBadge,
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
