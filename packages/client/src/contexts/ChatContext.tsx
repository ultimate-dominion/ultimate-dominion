import { Text, useDisclosure } from '@chakra-ui/react';

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
import { Link as RouterLink } from 'react-router-dom';
import { formatEther, zeroAddress } from 'viem';

import { useGameConfig, useGameTable, useGameValue, getTableValue, toNumber } from '../lib/gameStore';
import { encodeBytes32Key } from '../lib/gameStore/keys';
import { CHARACTERS_PATH, CLASS_PAGE_PATH, ITEM_PATH } from '../Routes';
import { IS_CHAT_BOX_OPEN_KEY } from '../utils/constants';
import { decodeMobInstanceId } from '../utils/helpers';

import { CLASS_COLORS, Rarity, RARITY_COLORS, TokenType } from '../utils/types';

import { useAuth } from './AuthContext';
import { useCharacter } from './CharacterContext';
import { useItems } from './ItemsContext';
import { useMap } from './MapContext';
import { useOrders } from './OrdersContext';
import { useQueue } from '../contexts/QueueContext';

const INDEXER_URL = (import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

// Boss mob ID — Basilisk is mob 12 on-chain
const BOSS_MOB_ID = '12';
const BOSS_NAME = 'Basilisk';
const BOSS_COLOR = '#E04040';

// Color mapping for indexer game events rendered in the world feed
const GAME_EVENT_COLORS: Record<string, string> = {
  level_up: '#4A8B4A',        // green
  death: '#8B4040',           // dark red
  pvp_kill: '#B85C3A',        // burnt orange — PvP victory
  character_created: '#9B8EC4', // purple
  class_selection: '#D4A54A', // gold
  fragment_found: '#A8DEFF',  // light blue
  loot_drop: '#C4A54A',      // warm gold — item found
};

// Indexer events that should NOT be merged (client-side handles with richer JSX)
const EXCLUDED_INDEXER_EVENTS = new Set<string>();

// Gold offers and sell listings older than this are filtered out
const ANNOUNCEMENT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
// Marketplace sales persist longer — low-volume, high-signal events
const MARKETPLACE_ANNOUNCEMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
// Boss announcements persist for same duration as marketplace (rare events)
const BOSS_ANNOUNCEMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** System event feed message (world tab) */
export type FeedMessage = {
  delivered: boolean;
  from: string;
  jsx?: JSX.Element;
  message: string;
  rarityColor?: string;
  timestamp: number;
};

/** Player chat message */
export type ChatMessage = {
  id: string;
  channel: string;
  senderAddress: string;
  senderName: string;
  senderCharacterId: string;
  content: string;
  timestamp: number;
};

export type ActiveTab = 'world' | 'global' | 'guild';

type ChatContextType = {
  // Panel & tab state
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // World feed (system events, read-only)
  worldMessages: FeedMessage[];

  // Chat channels
  globalMessages: ChatMessage[];
  guildMessages: ChatMessage[];
  guildId: string | null;

  // Sending
  sendMessage: (channel: string, content: string) => void;
  isSending: boolean;

  // Keyboard suppression (preserved for MovementContext)
  isMessageInputFocused: boolean;
  onSetMessageInputFocus: (isFocused: boolean) => void;

  // Unread counts
  unreadCount: number;       // total (for mobile FAB badge)
  worldUnread: number;
  globalUnread: number;
  guildUnread: number;
};

const ChatContext = createContext<ChatContextType>({
  isOpen: false,
  onOpen: () => {},
  onClose: () => {},
  activeTab: 'world',
  setActiveTab: () => {},
  worldMessages: [],
  globalMessages: [],
  guildMessages: [],
  guildId: null,
  sendMessage: () => {},
  isSending: false,
  isMessageInputFocused: false,
  onSetMessageInputFocus: () => {},
  unreadCount: 0,
  worldUnread: 0,
  globalUnread: 0,
  guildUnread: 0,
});

export type ChatProviderProps = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps): JSX.Element => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { ownerAddress: address } = useAuth();
  const {
    armorTemplates,
    consumableTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { allCharacters, allMonsters } = useMap();
  const { character: currentCharacter } = useCharacter();
  const { activeOrders } = useOrders();
  const { gameEvents, sendWsMessage, onChatMessage, onChatHistory, onChatError } = useQueue();

  const configValue = useGameConfig('UltimateDominionConfig');
  const goldToken = configValue ? String(configValue.goldToken) : null;

  const combatOutcomeRows = useGameTable('CombatOutcome');
  const marketplaceSaleRows = useGameTable('MarketplaceSale');

  // Chat state
  const [activeTab, setActiveTab] = useState<ActiveTab>('world');
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [guildMessages, setGuildMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);

  // Unread tracking
  const [worldUnread, setWorldUnread] = useState(0);
  const [globalUnread, setGlobalUnread] = useState(0);
  const [guildUnread, setGuildUnread] = useState(0);
  const lastSeenWorld = useRef(parseInt(localStorage.getItem('chat_last_seen_world') || '0', 10));
  const lastSeenGlobal = useRef(parseInt(localStorage.getItem('chat_last_seen_global') || '0', 10));
  const lastSeenGuild = useRef(parseInt(localStorage.getItem('chat_last_seen_guild') || '0', 10));

  // Guild membership detection
  const characterId = currentCharacter?.id;
  const memberKey = characterId ? encodeBytes32Key(characterId) : undefined;
  const memberData = useGameValue('GuildMember', memberKey);
  const myGuildId = memberData?.guildId as string | undefined;
  const isInGuild = !!myGuildId && myGuildId !== '0' && myGuildId !== '0x0000000000000000000000000000000000000000000000000000000000000000';
  const guildId = isInGuild ? myGuildId : null;
  const guildChannel = guildId ? `guild:${guildId}` : null;

  // Track previous guild to detect changes
  const prevGuildChannel = useRef<string | null>(null);

  // ── All item templates merged ──────────────────────────────────
  const allItems = useMemo(() => [
    ...armorTemplates,
    ...consumableTemplates,
    ...spellTemplates,
    ...weaponTemplates,
  ], [armorTemplates, consumableTemplates, spellTemplates, weaponTemplates]);

  // ── JSX Enrichment Pipeline (World Feed) ──────────────────────
  // These produce the FeedMessage[] that populate the World tab.

  // Rare+ marketplace transactions
  const rareMarketplaceSales: FeedMessage[] = useMemo(() => {
    const cutoff = Date.now() - MARKETPLACE_ANNOUNCEMENT_MAX_AGE_MS;
    return Object.values(marketplaceSaleRows)
    .map(data => {
      const { buyer, itemId, timestamp } = data;
      const ts = toNumber(timestamp) * 1000;
      if (ts < cutoff) return null;
      const item = allItems.find(i => i.tokenId === itemId!.toString());
      if (!item || item.rarity === undefined || item.rarity < Rarity.Rare) return null;
      const buyerCharacter = allCharacters.find(character => character.owner.toLowerCase() === String(buyer).toLowerCase());
      if (!buyerCharacter?.name) return null;
      const rarityColor = RARITY_COLORS[item.rarity];
      const buyerNameColor = CLASS_COLORS[buyerCharacter.entityClass] ?? '#E8DCC8';
      return {
        delivered: true,
        from: zeroAddress,
        jsx: (
          <Text fontWeight={500} size="xs" textAlign="center">
            <Text as={RouterLink} color={buyerNameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${buyerCharacter.id}`} _hover={{ textDecoration: 'underline' }}>{buyerCharacter.name}</Text>
            {' '}bought{' '}
            <Text as={RouterLink} color={rarityColor} fontWeight={700} to={`${ITEM_PATH}/${item.tokenId}`} _hover={{ textDecoration: 'underline' }}>{item.name}</Text>
            {' '}in the Marketplace!
          </Text>
        ),
        message: '',
        rarityColor,
        timestamp: toNumber(timestamp) * 1000,
      };
    })
    .filter(Boolean) as FeedMessage[];
  }, [marketplaceSaleRows, allCharacters, allItems]);

  // Stable "first seen" timestamps for marketplace listings
  const offerTimestamps = useRef<Map<string, number>>(new Map());
  const listingTimestamps = useRef<Map<string, number>>(new Map());

  // Gold offer broadcasts for Rare+ items (buy orders)
  const goldOfferAnnouncements: FeedMessage[] = useMemo(() => {
    if (!goldToken) return [];
    const now = Date.now();
    const cutoff = now - ANNOUNCEMENT_MAX_AGE_MS;
    const result = activeOrders
      .filter(order => {
        if (order.offer.tokenType !== TokenType.ERC20) return false;
        if (order.offer.token.toLowerCase() !== goldToken.toLowerCase()) return false;
        if (order.consideration.tokenType !== TokenType.ERC1155) return false;
        const item = allItems.find(i => i.tokenId === order.consideration.identifier.toString());
        if (!item || item.rarity === undefined || item.rarity < Rarity.Rare) return false;
        const offerer = allCharacters.find(c => c.owner.toLowerCase() === order.offerer.toLowerCase());
        if (!offerer?.name) return false;
        return true;
      })
      .map(order => {
        if (!offerTimestamps.current.has(order.orderHash)) {
          offerTimestamps.current.set(order.orderHash, now);
        }
        const ts = offerTimestamps.current.get(order.orderHash)!;
        if (ts < cutoff) return null;
        const item = allItems.find(i => i.tokenId === order.consideration.identifier.toString())!;
        const offererCharacter = allCharacters.find(c => c.owner.toLowerCase() === order.offerer.toLowerCase())!;
        const offererNameColor = CLASS_COLORS[offererCharacter.entityClass] ?? '#E8DCC8';
        const goldAmount = formatEther(order.offer.amount);
        const rarityColor = RARITY_COLORS[item.rarity!];
        return {
          delivered: true,
          from: zeroAddress,
          jsx: (
            <Text fontWeight={500} size="xs" textAlign="center">
              <Text as={RouterLink} color={offererNameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${offererCharacter.id}`} _hover={{ textDecoration: 'underline' }}>{offererCharacter.name}</Text>
              {' '}is offering{' '}
              <Text as="span" color="#D4A54A" fontWeight={700}>{goldAmount} Gold</Text>
              {' '}for{' '}
              <Text as={RouterLink} color={rarityColor} fontWeight={700} to={`${ITEM_PATH}/${item.tokenId}`} _hover={{ textDecoration: 'underline' }}>{item.name}</Text>!
            </Text>
          ),
          message: '',
          rarityColor,
          timestamp: ts,
        };
      })
      .filter(Boolean) as FeedMessage[];
    const activeHashes = new Set(activeOrders.map(o => o.orderHash));
    for (const hash of offerTimestamps.current.keys()) {
      if (!activeHashes.has(hash) || offerTimestamps.current.get(hash)! < cutoff) {
        offerTimestamps.current.delete(hash);
      }
    }
    return result;
  }, [activeOrders, allCharacters, allItems, goldToken]);

  // Rare+ sell listing broadcasts
  const sellListingAnnouncements: FeedMessage[] = useMemo(() => {
    if (!goldToken) return [];
    const now = Date.now();
    const cutoff = now - ANNOUNCEMENT_MAX_AGE_MS;
    const result = activeOrders
      .filter(order => {
        if (order.offer.tokenType !== TokenType.ERC1155) return false;
        if (order.consideration.tokenType !== TokenType.ERC20) return false;
        if (order.consideration.token.toLowerCase() !== goldToken.toLowerCase()) return false;
        const item = allItems.find(i => i.tokenId === order.offer.identifier.toString());
        if (!item || item.rarity === undefined || item.rarity < Rarity.Rare) return false;
        const offerer = allCharacters.find(c => c.owner.toLowerCase() === order.offerer.toLowerCase());
        if (!offerer?.name) return false;
        return true;
      })
      .map(order => {
        if (!listingTimestamps.current.has(order.orderHash)) {
          listingTimestamps.current.set(order.orderHash, now);
        }
        const ts = listingTimestamps.current.get(order.orderHash)!;
        if (ts < cutoff) return null;
        const item = allItems.find(i => i.tokenId === order.offer.identifier.toString())!;
        const offererCharacter = allCharacters.find(c => c.owner.toLowerCase() === order.offerer.toLowerCase())!;
        const offererNameColor = CLASS_COLORS[offererCharacter.entityClass] ?? '#E8DCC8';
        const goldAmount = formatEther(order.consideration.amount);
        const rarityColor = RARITY_COLORS[item.rarity!];
        return {
          delivered: true,
          from: zeroAddress,
          jsx: (
            <Text fontWeight={500} size="xs" textAlign="center">
              <Text as={RouterLink} color={offererNameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${offererCharacter.id}`} _hover={{ textDecoration: 'underline' }}>{offererCharacter.name}</Text>
              {' '}listed{' '}
              <Text as={RouterLink} color={rarityColor} fontWeight={700} to={`${ITEM_PATH}/${item.tokenId}`} _hover={{ textDecoration: 'underline' }}>{item.name}</Text>
              {' '}for{' '}
              <Text as="span" color="#D4A54A" fontWeight={700}>{goldAmount} Gold</Text>!
            </Text>
          ),
          message: '',
          rarityColor,
          timestamp: ts,
        };
      })
      .filter(Boolean) as FeedMessage[];
    const activeHashes = new Set(activeOrders.map(o => o.orderHash));
    for (const hash of listingTimestamps.current.keys()) {
      if (!activeHashes.has(hash) || listingTimestamps.current.get(hash)! < cutoff) {
        listingTimestamps.current.delete(hash);
      }
    }
    return result;
  }, [activeOrders, allCharacters, allItems, goldToken]);

  // Boss spawn announcements
  const bossSpawnTimestamps = useRef<Map<string, number>>(new Map());
  const bossSpawnAnnouncements: FeedMessage[] = useMemo(() => {
    const now = Date.now();
    const cutoff = now - BOSS_ANNOUNCEMENT_MAX_AGE_MS;
    const liveBasilisks = allMonsters.filter(
      m => m.mobId === BOSS_MOB_ID && m.isSpawned && m.currentHp > 0n,
    );
    for (const basilisk of liveBasilisks) {
      if (!bossSpawnTimestamps.current.has(basilisk.id)) {
        bossSpawnTimestamps.current.set(basilisk.id, now);
      }
    }
    const liveIds = new Set(liveBasilisks.map(b => b.id));
    for (const id of bossSpawnTimestamps.current.keys()) {
      if (!liveIds.has(id)) bossSpawnTimestamps.current.delete(id);
    }
    return liveBasilisks
      .map(basilisk => {
        const ts = bossSpawnTimestamps.current.get(basilisk.id)!;
        if (ts < cutoff) return null;
        const { x, y } = basilisk.position;
        return {
          delivered: true,
          from: zeroAddress,
          jsx: (
            <Text fontWeight={500} size="xs" textAlign="center">
              A{' '}<Text as="span" color={BOSS_COLOR} fontWeight={700}>{BOSS_NAME}</Text>{' '}has appeared at ({x}, {y})!
            </Text>
          ),
          message: '',
          rarityColor: BOSS_COLOR,
          timestamp: ts,
        };
      })
      .filter(Boolean) as FeedMessage[];
  }, [allMonsters]);

  // Boss kill announcements
  const bossKillAnnouncements: FeedMessage[] = useMemo(() => {
    const cutoff = Date.now() - BOSS_ANNOUNCEMENT_MAX_AGE_MS;
    return Object.entries(combatOutcomeRows)
      .map(([keyBytes, data]) => {
        const ts = toNumber(data.endTime) * 1000;
        if (ts < cutoff) return null;
        const encounterData = getTableValue('CombatEncounter', keyBytes);
        if (!encounterData) return null;
        const attackers = encounterData.attackers as string[];
        const defenders = encounterData.defenders as string[];
        const attackersWin = Boolean(data.attackersWin);
        const allEntities = [...attackers, ...defenders];
        const basiliskEntity = allEntities.find(entity => {
          try {
            const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
            return mobId === BOSS_MOB_ID;
          } catch { return false; }
        });
        if (!basiliskEntity) return null;
        const basiliskIsAttacker = attackers.includes(basiliskEntity);
        const basiliskDied = basiliskIsAttacker ? !attackersWin : attackersWin;
        if (!basiliskDied) return null;
        const winnerEntities = basiliskIsAttacker ? defenders : attackers;
        const winnerId = winnerEntities[0];
        const winnerCharacter = allCharacters.find(c => c.id === winnerId);
        const winnerName = winnerCharacter?.name;
        if (!winnerName) return null;
        const winnerNameColor = winnerCharacter ? (CLASS_COLORS[winnerCharacter.entityClass] ?? '#E8DCC8') : '#E8DCC8';
        return {
          delivered: true,
          from: zeroAddress,
          jsx: (
            <Text fontWeight={500} size="xs" textAlign="center">
              <Text as={RouterLink} color={winnerNameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${winnerId}`} _hover={{ textDecoration: 'underline' }}>{winnerName}</Text>
              {' '}has slain the{' '}
              <Text as="span" color={BOSS_COLOR} fontWeight={700}>{BOSS_NAME}</Text>!
            </Text>
          ),
          message: '',
          rarityColor: BOSS_COLOR,
          timestamp: ts,
        };
      })
      .filter(Boolean) as FeedMessage[];
  }, [combatOutcomeRows, allCharacters]);

  // Convert indexer game events to feed messages with linked player names
  const indexerEventAnnouncements: FeedMessage[] = useMemo(() => {
    const filtered = gameEvents.filter(e => !EXCLUDED_INDEXER_EVENTS.has(e.eventType));
    const recent = filtered.slice(-50);
    return recent.map(event => {
      const char = allCharacters.find(c => c.name === event.playerName);
      const nameColor = char ? (CLASS_COLORS[char.entityClass] ?? '#E8DCC8') : '#E8DCC8';
      const suffix = event.description.slice(event.playerName.length);
      const rarityColor = GAME_EVENT_COLORS[event.eventType] || '#8A7E6A';

      // Loot drops / rare finds: use metadata for colored item names with links
      if ((event.eventType === 'loot_drop' || event.eventType === 'rare_find') && event.metadata) {
        const itemId = event.metadata.itemId as string | undefined;
        const rarity = event.metadata.rarity as number | undefined;
        const itemName = event.metadata.itemName as string | undefined;
        const itemColor = rarity !== undefined ? (RARITY_COLORS[rarity as Rarity] || rarityColor) : rarityColor;
        return {
          delivered: true,
          from: zeroAddress,
          jsx: (
            <Text fontWeight={500} size="xs">
              {char ? (
                <Text as={RouterLink} color={nameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${char.id}`} _hover={{ textDecoration: 'underline' }}>{event.playerName}</Text>
              ) : (
                <Text as="span" color={nameColor} fontWeight={700}>{event.playerName}</Text>
              )}
              {' found '}
              {itemId && itemName ? (
                <Text as={RouterLink} color={itemColor} fontWeight={700} to={`${ITEM_PATH}/${itemId}`} _hover={{ textDecoration: 'underline' }}>{itemName}</Text>
              ) : (
                <Text as="span" color={itemColor} fontWeight={700}>{itemName || 'an item'}</Text>
              )}
              {'!'}
            </Text>
          ),
          message: '',
          rarityColor: itemColor,
          timestamp: event.timestamp,
        };
      }

      // PvP kills: link both winner and loser names
      if (event.eventType === 'pvp_kill') {
        const match = suffix.match(/^ defeated (.+) in PvP$/);
        if (match) {
          const loserName = match[1];
          const loserChar = allCharacters.find(c => c.name === loserName);
          const loserColor = loserChar ? (CLASS_COLORS[loserChar.entityClass] ?? '#E8DCC8') : '#E8DCC8';
          return {
            delivered: true,
            from: zeroAddress,
            jsx: (
              <Text fontWeight={500} size="xs">
                {char ? (
                  <Text as={RouterLink} color={nameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${char.id}`} _hover={{ textDecoration: 'underline' }}>{event.playerName}</Text>
                ) : (
                  <Text as="span" color={nameColor} fontWeight={700}>{event.playerName}</Text>
                )}
                {' defeated '}
                {loserChar ? (
                  <Text as={RouterLink} color={loserColor} fontWeight={700} to={`${CHARACTERS_PATH}/${loserChar.id}`} _hover={{ textDecoration: 'underline' }}>{loserName}</Text>
                ) : (
                  <Text as="span" color={loserColor} fontWeight={700}>{loserName}</Text>
                )}
                {' in PvP'}
              </Text>
            ),
            message: '',
            rarityColor,
            timestamp: event.timestamp,
          };
        }
      }

      // Class selection: link the class name to the class page
      if (event.eventType === 'class_selection') {
        const classMatch = suffix.match(/ as a (\w+)!?$/);
        if (classMatch) {
          const className = classMatch[1];
          const classSlug = className.toLowerCase();
          const middleText = suffix.slice(0, suffix.indexOf(` as a ${className}`)) + ' as a ';
          return {
            delivered: true,
            from: zeroAddress,
            jsx: (
              <Text fontWeight={500} size="xs">
                {char ? (
                  <Text as={RouterLink} color={nameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${char.id}`} _hover={{ textDecoration: 'underline' }}>{event.playerName}</Text>
                ) : (
                  <Text as="span" color={nameColor} fontWeight={700}>{event.playerName}</Text>
                )}
                {middleText}
                <Text as={RouterLink} color={rarityColor} fontWeight={700} to={`${CLASS_PAGE_PATH}/${classSlug}`} _hover={{ textDecoration: 'underline' }}>{className}</Text>
                {'!'}
              </Text>
            ),
            message: '',
            rarityColor,
            timestamp: event.timestamp,
          };
        }
      }

      // Default: link the player name, append rest as plain text
      return {
        delivered: true,
        from: zeroAddress,
        jsx: (
          <Text fontWeight={500} size="xs">
            {char ? (
              <Text as={RouterLink} color={nameColor} fontWeight={700} to={`${CHARACTERS_PATH}/${char.id}`} _hover={{ textDecoration: 'underline' }}>{event.playerName}</Text>
            ) : (
              <Text as="span" color={nameColor} fontWeight={700}>{event.playerName}</Text>
            )}
            {suffix}
          </Text>
        ),
        message: '',
        rarityColor,
        timestamp: event.timestamp,
      };
    });
  }, [gameEvents, allCharacters]);

  // ── Merged world feed messages ──────────────────────────────────
  const worldMessages = useMemo(() => {
    return [
      ...bossSpawnAnnouncements,
      ...bossKillAnnouncements,
      ...indexerEventAnnouncements,
      ...rareMarketplaceSales,
      ...goldOfferAnnouncements,
      ...sellListingAnnouncements,
    ].sort((a, b) => a.timestamp - b.timestamp);
  }, [indexerEventAnnouncements, bossSpawnAnnouncements, bossKillAnnouncements, rareMarketplaceSales, goldOfferAnnouncements, sellListingAnnouncements]);

  // ── WS Chat Message Handling ──────────────────────────────────
  // Wire up callback refs from QueueContext to receive chat messages

  useEffect(() => {
    onChatMessage.current = (msg: any) => {
      const chatMsg = msg.message as ChatMessage;
      if (!chatMsg) return;

      if (chatMsg.channel === 'global') {
        setGlobalMessages(prev => {
          if (prev.some(m => m.id === chatMsg.id)) return prev;
          const next = [...prev, chatMsg];
          return next.length > 200 ? next.slice(-200) : next;
        });
        // Track unread if not viewing global
        if (activeTab !== 'global' || !isOpen) {
          setGlobalUnread(prev => prev + 1);
        }
      } else if (chatMsg.channel.startsWith('guild:')) {
        setGuildMessages(prev => {
          if (prev.some(m => m.id === chatMsg.id)) return prev;
          const next = [...prev, chatMsg];
          return next.length > 200 ? next.slice(-200) : next;
        });
        if (activeTab !== 'guild' || !isOpen) {
          setGuildUnread(prev => prev + 1);
        }
      }
    };

    onChatHistory.current = (msg: any) => {
      const { channel, messages: historyMsgs } = msg as { channel: string; messages: ChatMessage[] };
      if (channel === 'global') {
        setGlobalMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = historyMsgs.filter(m => !existingIds.has(m.id));
          return [...newMsgs, ...prev].sort((a, b) => a.timestamp - b.timestamp).slice(-200);
        });
      } else if (channel.startsWith('guild:')) {
        setGuildMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = historyMsgs.filter(m => !existingIds.has(m.id));
          return [...newMsgs, ...prev].sort((a, b) => a.timestamp - b.timestamp).slice(-200);
        });
      }
    };

    onChatError.current = (msg: any) => {
      const { code } = msg as { code: string; message: string };
      if (code === 'rate_limited') {
        setIsSending(false);
      }
    };

    return () => {
      onChatMessage.current = null;
      onChatHistory.current = null;
      onChatError.current = null;
    };
  }, [activeTab, isOpen, onChatMessage, onChatHistory, onChatError]);

  // ── Fetch chat history on mount ──────────────────────────────
  const historyFetched = useRef(false);
  useEffect(() => {
    if (historyFetched.current) return;
    historyFetched.current = true;

    fetch(`${INDEXER_URL}/api/chat/history/global`)
      .then(res => res.ok ? res.json() : [])
      .then((messages: ChatMessage[]) => {
        if (messages.length > 0) setGlobalMessages(messages);
      })
      .catch(() => {});
  }, []);

  // Fetch guild history when guild changes
  useEffect(() => {
    if (!guildChannel) {
      setGuildMessages([]);
      return;
    }

    fetch(`${INDEXER_URL}/api/chat/history/${encodeURIComponent(guildChannel)}`)
      .then(res => res.ok ? res.json() : [])
      .then((messages: ChatMessage[]) => {
        if (messages.length > 0) setGuildMessages(messages);
      })
      .catch(() => {});
  }, [guildChannel]);

  // ── Guild channel subscription ──────────────────────────────
  useEffect(() => {
    if (guildChannel && guildChannel !== prevGuildChannel.current) {
      // Join new guild channel
      sendWsMessage({ type: 'chat:join', channel: guildChannel });
    }
    if (prevGuildChannel.current && prevGuildChannel.current !== guildChannel) {
      // Leave old guild channel
      sendWsMessage({ type: 'chat:leave', channel: prevGuildChannel.current });
    }
    prevGuildChannel.current = guildChannel;
  }, [guildChannel, sendWsMessage]);

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback((channel: string, content: string) => {
    if (!content.trim() || !address) return;
    setIsSending(true);
    sendWsMessage({
      type: 'chat:send',
      channel,
      content: content.trim(),
      senderAddress: address.toLowerCase(),
    });
    // Optimistically clear sending state after a short delay
    // (the server will broadcast the message back to us)
    setTimeout(() => setIsSending(false), 300);
  }, [address, sendWsMessage]);

  // ── Unread tracking ──────────────────────────────────────────
  // World unread: track new events since last seen
  useEffect(() => {
    if (isOpen && activeTab === 'world') {
      setWorldUnread(0);
      lastSeenWorld.current = Date.now();
      localStorage.setItem('chat_last_seen_world', Date.now().toString());
    } else {
      const unread = worldMessages.filter(m => m.timestamp > lastSeenWorld.current).length;
      setWorldUnread(unread);
    }
  }, [isOpen, activeTab, worldMessages]);

  // Clear channel unread when viewing it
  useEffect(() => {
    if (isOpen && activeTab === 'global') {
      setGlobalUnread(0);
      lastSeenGlobal.current = Date.now();
      localStorage.setItem('chat_last_seen_global', Date.now().toString());
    }
  }, [isOpen, activeTab, globalMessages]);

  useEffect(() => {
    if (isOpen && activeTab === 'guild') {
      setGuildUnread(0);
      lastSeenGuild.current = Date.now();
      localStorage.setItem('chat_last_seen_guild', Date.now().toString());
    }
  }, [isOpen, activeTab, guildMessages]);

  const unreadCount = worldUnread + globalUnread + guildUnread;

  // ── Keyboard suppression ──────────────────────────────────────
  const onSetMessageInputFocus = useCallback((isFocused: boolean) => {
    setIsMessageInputFocused(isFocused);
  }, []);

  // ── Open/Close with persistence ──────────────────────────────
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
        isOpen,
        onOpen: onOpenAndSet,
        onClose: onCloseAndClear,
        activeTab,
        setActiveTab,
        worldMessages,
        globalMessages,
        guildMessages,
        guildId,
        sendMessage,
        isSending,
        isMessageInputFocused,
        onSetMessageInputFocus,
        unreadCount,
        worldUnread,
        globalUnread,
        guildUnread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => useContext(ChatContext);
