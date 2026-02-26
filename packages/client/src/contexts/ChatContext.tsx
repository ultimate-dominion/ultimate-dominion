import { Text, useDisclosure } from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import { getComponentValueStrict, Has } from '@latticexyz/recs';

import type {
  GroupDTO,
  MessageEvent,
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

import { Character, Rarity, RARITY_COLORS, RARITY_NAMES } from '../utils/types';

import { useAuth } from './AuthContext';
import { useCharacter } from './CharacterContext';
import { useItems } from './ItemsContext';
import { useMap } from './MapContext';

import { useMUD } from './MUDContext';

// Push Protocol environment: 'prod' for deployed sites, 'staging' for localhost
// Values match @pushprotocol/restapi CONSTANTS.ENV — inlined to avoid static import
const PUSH_ENV = import.meta.env.VITE_PUSH_ENV === 'prod' ? 'prod'
  : import.meta.env.DEV ? 'staging' : 'prod';

// Group chat ID — differs between staging and prod environments
const PROD_GROUP_CHAT_ID = '0e66a86ac97a353b068c556612f949f223101ce9a52a3b5ec8f305f989d917f8';
const STAGING_GROUP_CHAT_ID = '20ca5a940d23fae1191bcf39a7f02cafd02d5427b7f6aa8a1b882c8641239475';
const GROUP_CHAT_ID = import.meta.env.VITE_PUSH_GROUP_CHAT_ID ||
  (PUSH_ENV === 'prod' ? PROD_GROUP_CHAT_ID : STAGING_GROUP_CHAT_ID);

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
  unreadCount: number;
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
  unreadCount: 0,
});

export type ChatProviderProps = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const {
    authMethod,
    embeddedWallet,
    embeddedWalletClient,
    externalWalletClient,
    ownerAddress: address,
    thirdwebClient,
    thirdwebChain,
  } = useAuth();
  const publicClient = usePublicClient();
  // Use the appropriate wallet client for Push Protocol
  const data = authMethod === 'embedded' ? embeddedWalletClient : externalWalletClient;
  const {
    components: { CombatEncounter, CombatOutcome, MarketplaceSale },
  } = useMUD();
  const {
    armorTemplates,
    consumableTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { allCharacters, isSpawned } = useMap();
  const { character: currentCharacter } = useCharacter();

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [user, setUser] = useState<PushAPI | null>(null);

  const [isGroupMember, setIsGroupMember] = useState<boolean>(false);
  const [isJoiningGroupChat, setIsJoiningGroupChat] = useState<boolean>(false);

  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const allItems = useMemo(() => [
    ...armorTemplates,
    ...consumableTemplates,
    ...spellTemplates,
    ...weaponTemplates,
  ], [armorTemplates, consumableTemplates, spellTemplates, weaponTemplates]);

  // Rare+ item drop announcements from battle outcomes
  const battleOutcomeEntities = useEntityQuery([Has(CombatOutcome)]);
  const rareDropAnnouncements: Message[] = useMemo(() => battleOutcomeEntities
    .map(entity => {
      const combatOutcome = getComponentValueStrict(CombatOutcome, entity);
      const { itemsDropped } = combatOutcome;
      if (!itemsDropped || itemsDropped.length === 0) return null;

      const encounter = getComponentValueStrict(CombatEncounter, entity);
      const attackerId = encounter.attackers[0];
      const defenderId = encounter.defenders[0];

      const winner = combatOutcome.attackersWin ? attackerId : defenderId;
      const winnerName = allCharacters.find(c => c.id === winner)?.name;
      if (!winnerName) return null;

      const rareDrops = itemsDropped
        .map(itemId => allItems.find(item => item.tokenId === itemId.toString()))
        .filter(item => item && item.rarity !== undefined && item.rarity >= Rarity.Rare);

      if (rareDrops.length === 0) return null;

      const droppedItem = rareDrops[0]!;
      const rarityName = RARITY_NAMES[droppedItem.rarity!];
      const rarityColor = RARITY_COLORS[droppedItem.rarity!];

      return {
        delivered: true,
        from: zeroAddress,
        jsx: (
          <Text fontWeight={500} size="xs" textAlign="center">
            {winnerName} found{' '}
            <Text as="span" color={rarityColor} fontWeight={700}>
              {droppedItem.name}
            </Text>{' '}
            ({rarityName})!
          </Text>
        ),
        message: '',
        timestamp: Number(combatOutcome.endTime) * 1000,
      };
    })
    .filter((m): m is Message => m !== null),
  [battleOutcomeEntities, allCharacters, allItems]);

  // Rare+ marketplace transactions only
  const marketplaceSaleEntities = useEntityQuery([Has(MarketplaceSale)]);
  const rareMarketplaceSales: Message[] = useMemo(() => marketplaceSaleEntities
    .map(entity => {
      const marketplaceSale = getComponentValueStrict(MarketplaceSale, entity);
      const { buyer, itemId, timestamp } = marketplaceSale;

      const item = allItems.find(i => i.tokenId === itemId.toString());
      if (!item || item.rarity === undefined || item.rarity < Rarity.Rare) return null;

      const customerName =
        allCharacters.find(character => character.owner === buyer)?.name ?? null;
      if (!customerName) return null;

      const rarityColor = RARITY_COLORS[item.rarity];

      return {
        delivered: true,
        from: zeroAddress,
        jsx: (
          <Text fontWeight={500} size="xs" textAlign="center">
            {customerName} bought{' '}
            <Text as="span" color={rarityColor} fontWeight={700}>
              {item.name}
            </Text>{' '}
            in the Marketplace!
          </Text>
        ),
        message: '',
        timestamp: Number(timestamp) * 1000,
      };
    })
    .filter((m): m is Message => m !== null),
  [marketplaceSaleEntities, allCharacters, allItems]);

  const messagesAndEvents = useMemo(() => {
    return [
      ...messages,
      ...rareDropAnnouncements,
      ...rareMarketplaceSales,
    ].sort((a, b) => a.timestamp - b.timestamp);
  }, [rareDropAnnouncements, rareMarketplaceSales, messages]);

  // Track unread messages using last-seen timestamp (persists across refreshes)
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        localStorage.setItem('chat_last_seen', Date.now().toString());
      }
    } else {
      const lastSeen = parseInt(
        localStorage.getItem('chat_last_seen') || Date.now().toString(),
        10,
      );
      const unread = messages.filter(
        m => m.timestamp > lastSeen && m.delivered,
      ).length;
      setUnreadCount(unread);
    }
  }, [isOpen, messages]);

  const onLogin = useCallback(async () => {
    try {
      if (user) return;
      if (!data) return;

      if (!GROUP_CHAT_ID) {
        throw new Error('Group chat ID is missing');
      }

      setIsLoggingIn(true);

      // Lazy-load Push Protocol SDK — only when user actually opens chat
      const { PushAPI: PushSDK, CONSTANTS } = await import('@pushprotocol/restapi');

      // Try cached PGP key first to skip the wallet signature popup on refresh
      const cachedPgpKey = sessionStorage.getItem('push_pgp_key');
      const cachedAccount = sessionStorage.getItem('push_account');

      let _user: Awaited<ReturnType<typeof PushSDK.initialize>> | null = null;

      if (cachedPgpKey && cachedAccount) {
        try {
          _user = await PushSDK.initialize(null, {
            env: PUSH_ENV,
            account: cachedAccount,
            decryptedPGPPrivateKey: cachedPgpKey,
          });
        } catch {
          // Cached key stale — clear and fall through to signer-based init
          sessionStorage.removeItem('push_pgp_key');
          sessionStorage.removeItem('push_account');
        }
      }

      if (!_user) {
        // For embedded wallets, use the admin (EOA) account for Push Protocol.
        // Smart account signatures don't verify via ecrecover, causing 400 errors.
        let pushSigner = data;
        if (authMethod === 'embedded' && embeddedWallet?.getAdminAccount) {
          const adminAccount = embeddedWallet.getAdminAccount();
          if (adminAccount) {
            const { viemAdapter } = await import('thirdweb/adapters/viem');
            pushSigner = viemAdapter.walletClient.toViem({
              client: thirdwebClient,
              chain: thirdwebChain,
              account: adminAccount,
            });
          }
        }

        _user = await PushSDK.initialize(pushSigner, {
          env: PUSH_ENV,
        });
      }

      // Cache PGP key so subsequent refreshes skip the signature popup
      if (_user.decryptedPgpPvtKey) {
        sessionStorage.setItem('push_pgp_key', _user.decryptedPgpPvtKey);
        sessionStorage.setItem('push_account', _user.account);
      }

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
        if (message.event.split('.')[1] === 'Message') {
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
  }, [authMethod, data, embeddedWallet, renderError, thirdwebChain, thirdwebClient, user]);

  // Auto-login only when a cached PGP key exists (no MetaMask popup).
  // First-time users click the Login button manually.
  useEffect(() => {
    const hasCachedKey = sessionStorage.getItem('push_pgp_key');
    if (hasCachedKey && isSpawned && data && !user && !isLoggingIn) {
      onLogin();
    }
  }, [isSpawned, data, user, isLoggingIn, onLogin]);

  // Cleanup Push Protocol stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.disconnect();
        streamRef.current = null;
      }
    };
  }, []);

  // Poll for new messages as fallback (Push streams are unreliable)
  useEffect(() => {
    if (!user || !isGroupMember) return;

    const pollInterval = setInterval(async () => {
      try {
        // Only fetch last 5 messages to minimize API load
        const recent = await user.chat.history(GROUP_CHAT_ID, { limit: 5 });
        const fetched = recent.map(msg => ({
          delivered: true,
          from: msg.fromDID.split(':')[1],
          message: msg.messageContent,
          timestamp: Number(msg.timestamp),
        })).reverse();

        setMessages(prev => {
          // Check if the latest fetched message is newer than what we have
          const prevTimestamps = new Set(prev.filter(m => m.delivered).map(m => m.timestamp));
          const newMsgs = fetched.filter(m => !prevTimestamps.has(m.timestamp));
          if (newMsgs.length === 0) return prev;
          // Append new messages, preserving optimistic (undelivered) at end
          const delivered = prev.filter(m => m.delivered);
          const optimistic = prev.filter(m => !m.delivered);
          return [...delivered, ...newMsgs, ...optimistic];
        });
      } catch {
        // Silently ignore poll failures
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [user, isGroupMember]);

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
    setUnreadCount(0);
    localStorage.setItem('chat_last_seen', Date.now().toString());
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
        unreadCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => useContext(ChatContext);
