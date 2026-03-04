import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

const INDEXER_URL = (import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

type QueueStatus = 'idle' | 'joining' | 'waiting' | 'ready' | 'spawned';

type InviteCode = {
  code: string;
  milestone: string;
  usedBy: string | null;
};

type InviteStats = {
  totalCodes: number;
  codesUsed: number;
  activated: number;
  bonusCodes: number;
};

type GameEvent = {
  id: string;
  eventType: string;
  playerName: string;
  description: string;
  timestamp: number;
};

type QueueContextType = {
  queuePosition: number;
  totalInQueue: number;
  slotsAvailable: number;
  currentPlayers: number;
  maxPlayers: number;
  queueStatus: QueueStatus;
  readyUntil: Date | null;
  estimatedWaitMinutes: number;
  priority: string;
  inviteCodes: InviteCode[];
  inviteStats: InviteStats;
  gameEvents: GameEvent[];
  isMapFull: boolean;
  statsLoaded: boolean;
  joinQueue: (captchaToken: string, inviteCode?: string) => Promise<void>;
  leaveQueue: () => Promise<void>;
  acknowledgeSlot: () => Promise<void>;
  reportSpawned: () => Promise<void>;
  refreshInviteCodes: () => Promise<void>;
};

const defaultInviteStats: InviteStats = {
  totalCodes: 0,
  codesUsed: 0,
  activated: 0,
  bonusCodes: 0,
};

const QueueContext = createContext<QueueContextType>({
  queuePosition: 0,
  totalInQueue: 0,
  slotsAvailable: 0,
  currentPlayers: 0,
  maxPlayers: 10,
  queueStatus: 'idle',
  readyUntil: null,
  estimatedWaitMinutes: 0,
  priority: 'normal',
  inviteCodes: [],
  inviteStats: defaultInviteStats,
  gameEvents: [],
  isMapFull: false,
  statsLoaded: false,
  joinQueue: async () => {},
  leaveQueue: async () => {},
  acknowledgeSlot: async () => {},
  reportSpawned: async () => {},
  refreshInviteCodes: async () => {},
});

export const useQueue = () => useContext(QueueContext);

const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = 25000;

export const QueueProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const { isAuthenticated, ownerAddress } = useAuth();
  const wallet = ownerAddress?.toLowerCase() ?? '';

  const [queuePosition, setQueuePosition] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const [slotsAvailable, setSlotsAvailable] = useState(0);
  const [currentPlayers, setCurrentPlayers] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [readyUntil, setReadyUntil] = useState<Date | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState(0);
  const [priority, setPriority] = useState('normal');
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteStats, setInviteStats] = useState<InviteStats>(defaultInviteStats);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempts = useRef(0);
  const disposedRef = useRef(false);
  const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitleRef = useRef(document.title);

  const isMapFull = useMemo(() => currentPlayers >= maxPlayers, [currentPlayers, maxPlayers]);

  // WS connection for queue notifications
  const connectWs = useCallback(() => {
    if (disposedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
    }

    const wsUrl = INDEXER_URL.replace(/^http/, 'ws') + '/ws';
    try {
      wsRef.current = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }

    wsRef.current.onopen = () => {
      reconnectAttempts.current = 0;
      // Start heartbeat (only when tab is visible)
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (!document.hidden) {
        heartbeatTimerRef.current = setInterval(() => {
          if (document.hidden || wsRef.current?.readyState !== WebSocket.OPEN) return;
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }, HEARTBEAT_INTERVAL);
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'queue:stats':
            setTotalInQueue(msg.stats.totalInQueue);
            setSlotsAvailable(msg.stats.slotsAvailable);
            setCurrentPlayers(msg.stats.currentPlayers);
            break;

          case 'queue:slot_open':
            if (wallet && msg.wallet === wallet) {
              setQueueStatus('ready');
              setReadyUntil(new Date(msg.readyUntil));
            }
            break;

          case 'game:event':
            setGameEvents((prev) => {
              const next = [...prev, msg.event];
              return next.length > 50 ? next.slice(-50) : next;
            });
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    wsRef.current.onclose = () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (!disposedRef.current) scheduleReconnect();
    };

    wsRef.current.onerror = () => {
      // onclose will fire after
    };
  }, [wallet]);

  const scheduleReconnect = useCallback(() => {
    if (disposedRef.current) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
      RECONNECT_MAX_DELAY,
    );
    reconnectAttempts.current++;
    reconnectTimerRef.current = setTimeout(() => connectWs(), delay);
  }, [connectWs]);

  // Connect WS on mount, disconnect on unmount
  useEffect(() => {
    disposedRef.current = false;
    connectWs();
    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  // Pause/resume heartbeat on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
      } else if (wsRef.current?.readyState === WebSocket.OPEN && !heartbeatTimerRef.current) {
        heartbeatTimerRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Poll position when in queue (pauses when tab hidden)
  useEffect(() => {
    if (!wallet || queueStatus === 'idle' || queueStatus === 'spawned') return;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const resp = await fetch(`${INDEXER_URL}/api/queue/position/${wallet}`);
        const data = await resp.json();
        if (data.inQueue) {
          setQueuePosition(data.position);
          setTotalInQueue(data.totalInQueue);
          setSlotsAvailable(data.slotsAvailable);
          setMaxPlayers(data.maxPlayers);
          setCurrentPlayers(data.currentPlayers);
          setEstimatedWaitMinutes(data.estimatedWaitMinutes);
          setPriority(data.priority);
          if (data.status === 'ready') {
            setQueueStatus('ready');
            setReadyUntil(data.readyUntil ? new Date(data.readyUntil) : null);
          } else if (data.status === 'waiting') {
            // Slot expired — bumped back to waiting
            setQueueStatus('waiting');
            setReadyUntil(null);
          }
        } else {
          // Not in queue anymore (spawned or removed)
          setSlotsAvailable(data.slotsAvailable ?? 0);
          setMaxPlayers(data.maxPlayers ?? 10);
          setCurrentPlayers(data.currentPlayers ?? 0);
        }
      } catch {
        // ignore polling errors
      }
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      poll();
      interval = setInterval(poll, 10_000);
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => {
      if (document.hidden) stopPolling(); else startPolling();
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [wallet, queueStatus]);

  // Fetch initial stats (for non-queued users to see if map is full)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resp = await fetch(`${INDEXER_URL}/api/queue/stats`);
        const data = await resp.json();
        setTotalInQueue(data.totalInQueue);
        setSlotsAvailable(data.slotsAvailable);
        setMaxPlayers(data.maxPlayers ?? 10);
        setCurrentPlayers(data.currentPlayers ?? 0);
      } catch {
        // ignore
      } finally {
        setStatsLoaded(true);
      }
    };
    fetchStats();
  }, []);

  // Fetch initial game events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const resp = await fetch(`${INDEXER_URL}/api/queue/feed`);
        const data = await resp.json();
        if (data.events) setGameEvents(data.events);
      } catch {
        // ignore
      }
    };
    fetchEvents();
  }, []);

  const refreshInviteCodes = useCallback(async () => {
    if (!wallet) {
      console.warn('[queue] Cannot refresh invite codes — no wallet');
      return;
    }
    try {
      console.info('[queue] Refreshing invite codes for', wallet);
      const [codesResp, statsResp] = await Promise.all([
        fetch(`${INDEXER_URL}/api/invite/codes/${wallet}`),
        fetch(`${INDEXER_URL}/api/invite/stats/${wallet}`),
      ]);
      const codesData = await codesResp.json();
      const statsData = await statsResp.json();
      console.info('[queue] Invite codes response:', codesData);
      setInviteCodes(codesData.codes ?? []);
      setInviteStats(statsData);
    } catch (err) {
      console.error('[queue] Failed to refresh invite codes:', err);
    }
  }, [wallet]);

  const joinQueue = useCallback(async (captchaToken: string, inviteCode?: string) => {
    if (!wallet) {
      console.error('[queue] Cannot join queue — wallet address not available. isAuthenticated:', isAuthenticated);
      return;
    }
    setQueueStatus('joining');
    try {
      const resp = await fetch(`${INDEXER_URL}/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          captchaToken,
          inviteCode: inviteCode || sessionStorage.getItem('ud:inviteCode') || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error('[queue] Join failed:', data.error);
        setQueueStatus('idle');
        return;
      }
      setQueuePosition(data.position);
      setTotalInQueue(data.totalInQueue);
      setPriority(data.priority);
      setQueueStatus('waiting');
      // Clear stored invite code after use
      sessionStorage.removeItem('ud:inviteCode');
      // Refresh invite codes — server seeds starter codes on first join
      refreshInviteCodes();
    } catch (err) {
      console.error('[queue] Join error:', err);
      setQueueStatus('idle');
    }
  }, [wallet, isAuthenticated, refreshInviteCodes]);

  const leaveQueue = useCallback(async () => {
    if (!wallet) return;
    try {
      await fetch(`${INDEXER_URL}/api/queue/leave/${wallet}`, { method: 'DELETE' });
      setQueueStatus('idle');
      setQueuePosition(0);
      setReadyUntil(null);
    } catch (err) {
      console.error('[queue] Leave error:', err);
    }
  }, [wallet]);

  const acknowledgeSlot = useCallback(async () => {
    if (!wallet) return;
    try {
      await fetch(`${INDEXER_URL}/api/queue/ready-ack/${wallet}`, { method: 'POST' });
    } catch (err) {
      console.error('[queue] Ack error:', err);
    }
  }, [wallet]);

  const reportSpawned = useCallback(async () => {
    if (!wallet) return;
    try {
      await fetch(`${INDEXER_URL}/api/queue/spawned/${wallet}`, { method: 'POST' });
      setQueueStatus('spawned');
      setReadyUntil(null);
    } catch (err) {
      console.error('[queue] Spawned report error:', err);
    }
  }, [wallet]);

  // Load invite codes when wallet changes
  useEffect(() => {
    if (wallet && isAuthenticated) {
      refreshInviteCodes();
    }
  }, [wallet, isAuthenticated, refreshInviteCodes]);

  // Request notification permission when joining queue
  useEffect(() => {
    if (queueStatus === 'waiting' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [queueStatus]);

  // Slot-open notifications: browser push, audio chime, tab title flash
  useEffect(() => {
    if (queueStatus !== 'ready') {
      // Clean up title flash when leaving ready state
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
        document.title = originalTitleRef.current;
      }
      return;
    }

    // 1. Browser push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('A slot has opened!', {
          body: 'Your turn to enter Ultimate Dominion. You have 2 minutes.',
          icon: '/favicon.ico',
          tag: 'ud-slot-open',
        });
      } catch {
        // Mobile Safari doesn't support Notification constructor
      }
    }

    // 2. Audio chime (Web Audio API — two-tone medieval bell)
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // First tone — warm mid frequency
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Second tone — perfect fifth above, slightly delayed
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.5);

      // Clean up after sounds finish
      setTimeout(() => ctx.close(), 2000);
    } catch {
      // Web Audio not available
    }

    // 3. Tab title flash
    originalTitleRef.current = document.title;
    let showAlert = true;
    titleFlashRef.current = setInterval(() => {
      document.title = showAlert ? 'A Slot Has Opened!' : originalTitleRef.current;
      showAlert = !showAlert;
    }, 1000);

    return () => {
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
        document.title = originalTitleRef.current;
      }
    };
  }, [queueStatus]);

  const value = useMemo<QueueContextType>(() => ({
    queuePosition,
    totalInQueue,
    slotsAvailable,
    currentPlayers,
    maxPlayers,
    queueStatus,
    readyUntil,
    estimatedWaitMinutes,
    priority,
    inviteCodes,
    inviteStats,
    gameEvents,
    isMapFull,
    statsLoaded,
    joinQueue,
    leaveQueue,
    acknowledgeSlot,
    reportSpawned,
    refreshInviteCodes,
  }), [
    queuePosition,
    totalInQueue,
    slotsAvailable,
    currentPlayers,
    maxPlayers,
    queueStatus,
    readyUntil,
    estimatedWaitMinutes,
    priority,
    inviteCodes,
    inviteStats,
    gameEvents,
    isMapFull,
    statsLoaded,
    joinQueue,
    leaveQueue,
    acknowledgeSlot,
    reportSpawned,
    refreshInviteCodes,
  ]);

  return (
    <QueueContext.Provider value={value}>
      {children}
    </QueueContext.Provider>
  );
};
