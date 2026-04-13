import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';

import { useAuth } from './AuthContext';
import { useBattle } from './BattleContext';
import { useMap } from './MapContext';

const SOUND_ENABLED_KEY = 'ud:sound-enabled';
const SOUND_AUTO_STARTED_KEY = 'ud:sound-auto-started';
const AMBIENT_VOLUME = 0.25;
const BATTLE_VOLUME = 0.3;

// Crossfade timings — tuned for the feeling of combat, not the literal state.
// Punch in fast when a fight starts. Exhale slow when it ends, so two fights
// back-to-back never drop out of the battle mood.
const ZONE_CROSSFADE_MS = 2000;
const BATTLE_ENTER_CROSSFADE_MS = 600;
const BATTLE_EXIT_CROSSFADE_MS = 3000;

// After combat ends, keep the battle track playing for this long. If another
// fight starts within the window, we stay in battle mode. Prevents jarring
// music whiplash during grinding.
const BATTLE_LINGER_MS = 5000;

const ZONE_AUDIO: Record<number, string> = {
  1: '/audio/dark-cave-mix.ogg',
  2: '/audio/windy-peaks-mix.ogg',
};

const BATTLE_AUDIO: Record<number, string> = {
  1: '/audio/battle-dark-cave-mix.ogg',
  2: '/audio/battle-windy-peaks-mix.ogg',
};

type TrackKey = { zone: number; battle: boolean };

type SoundContextValue = {
  soundEnabled: boolean;
  toggleSound: () => void;
};

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: false,
  toggleSound: () => {},
});

export const useGameAudio = () => useContext(SoundContext);

const keyEq = (a: TrackKey | null, b: TrackKey | null) =>
  a !== null && b !== null && a.zone === b.zone && a.battle === b.battle;

export const SoundProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const { currentZone } = useMap();
  const { currentBattle } = useBattle();

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
    console.log('[SoundContext] mount — stored soundEnabled:', stored, 'zone:', currentZone, 'isAuth:', isAuthenticated);
    return stored;
  });

  // True while a fight is live OR while lingering after a fight just ended.
  // Initialize from currentBattle so we don't flash ambient music for one tick
  // when the player loads the page mid-combat.
  const [battleMode, setBattleMode] = useState(() => currentBattle !== null);

  const ambientHowlsRef = useRef<Record<number, Howl>>({});
  const battleHowlsRef = useRef<Record<number, Howl>>({});
  const activeTrackRef = useRef<TrackKey | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartedRef = useRef(false);

  const inCombat = currentBattle !== null;

  const missingZoneWarnedRef = useRef<Set<string>>(new Set());

  const getHowl = useCallback((zoneId: number, battle: boolean): Howl | null => {
    const map = battle ? BATTLE_AUDIO : ZONE_AUDIO;
    const cache = battle ? battleHowlsRef.current : ambientHowlsRef.current;
    let src = map[zoneId];
    let resolvedZone = zoneId;

    if (!src) {
      const warnKey = `${battle ? 'battle' : 'ambient'}:${zoneId}`;
      if (!missingZoneWarnedRef.current.has(warnKey)) {
        missingZoneWarnedRef.current.add(warnKey);
        console.warn(
          `[SoundContext] No ${battle ? 'battle' : 'ambient'} track for zone ${zoneId}; falling back to zone 1`,
        );
      }
      // Fall back to zone 1 rather than going silent — any track beats none.
      src = map[1];
      resolvedZone = 1;
      if (!src) return null;
    }

    if (!cache[resolvedZone]) {
      console.log('[SoundContext] creating Howl', { src, zone: resolvedZone, battle });
      cache[resolvedZone] = new Howl({
        src: [src],
        loop: true,
        volume: 0,
        preload: true,
        onload: () => console.log('[SoundContext] Howl loaded', src),
        onloaderror: (_id, err) => console.error('[SoundContext] Howl load error', src, err),
        onplayerror: (_id, err) => console.error('[SoundContext] Howl play error', src, err),
        onplay: () => console.log('[SoundContext] Howl playing', src),
      });
    }
    return cache[resolvedZone];
  }, []);

  // Auto-enable sound when user authenticates (once per session).
  useEffect(() => {
    console.log('[SoundContext] auto-enable check', {
      isAuthenticated,
      soundEnabled,
      autoStarted: autoStartedRef.current,
      sessionFlag: sessionStorage.getItem(SOUND_AUTO_STARTED_KEY),
    });
    if (
      isAuthenticated &&
      !soundEnabled &&
      !autoStartedRef.current &&
      sessionStorage.getItem(SOUND_AUTO_STARTED_KEY) !== '1'
    ) {
      console.log('[SoundContext] auto-enabling sound');
      autoStartedRef.current = true;
      sessionStorage.setItem(SOUND_AUTO_STARTED_KEY, '1');
      setSoundEnabled(true);
      localStorage.setItem(SOUND_ENABLED_KEY, 'true');
    }
  }, [isAuthenticated, soundEnabled]);

  // Autoplay unlock: browsers suspend the audio context until a user gesture.
  // Register listeners unconditionally when sound is enabled — Howler.ctx may
  // not exist yet when this effect first runs (it's lazy-initialized on the
  // first Howl construction), so we can't early-bail on ctx state. Howler has
  // its own auto-unlock but in practice it doesn't always flush queued plays
  // reliably, so we also nudge the active Howl back on.
  useEffect(() => {
    if (!soundEnabled) return;

    const unlock = () => {
      const ctx = Howler.ctx;
      console.log('[SoundContext] unlock gesture', { ctxState: ctx?.state, active: activeTrackRef.current });
      if (ctx && ctx.state !== 'running') {
        ctx.resume().then(() => {
          console.log('[SoundContext] ctx resumed, new state:', Howler.ctx?.state);
        }).catch((err) => {
          console.error('[SoundContext] ctx resume failed', err);
        });
      }
      const active = activeTrackRef.current;
      if (active) {
        const cache = active.battle ? battleHowlsRef.current : ambientHowlsRef.current;
        const howl = cache[active.zone];
        if (howl && !howl.playing()) {
          console.log('[SoundContext] unlock: nudging active Howl back on');
          howl.play();
        }
      }
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [soundEnabled]);

  // Battle mode state machine. Instant entry on combat start; 5s linger on end.
  useEffect(() => {
    if (inCombat) {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      setBattleMode(true);
      return;
    }
    // Combat just ended — schedule exit from battle mode.
    if (battleMode && lingerTimerRef.current === null) {
      lingerTimerRef.current = setTimeout(() => {
        lingerTimerRef.current = null;
        setBattleMode(false);
      }, BATTLE_LINGER_MS);
    }
  }, [inCombat, battleMode]);

  // Main playback effect — crossfades between the correct track for the
  // (zone, battleMode) tuple. Picks crossfade duration based on transition type.
  useEffect(() => {
    console.log('[SoundContext] playback effect', {
      soundEnabled,
      currentZone,
      battleMode,
      ctxState: Howler.ctx?.state,
      active: activeTrackRef.current,
    });
    if (!soundEnabled) {
      for (const howl of Object.values(ambientHowlsRef.current)) howl.stop();
      for (const howl of Object.values(battleHowlsRef.current)) howl.stop();
      activeTrackRef.current = null;
      return;
    }

    const desired: TrackKey = { zone: currentZone, battle: battleMode };
    if (keyEq(activeTrackRef.current, desired)) {
      console.log('[SoundContext] playback effect — already on desired track, no-op');
      return;
    }

    const prev = activeTrackRef.current;

    // Pick crossfade timing from the transition type.
    let fadeMs = ZONE_CROSSFADE_MS;
    if (prev) {
      if (!prev.battle && desired.battle) fadeMs = BATTLE_ENTER_CROSSFADE_MS;
      else if (prev.battle && !desired.battle) fadeMs = BATTLE_EXIT_CROSSFADE_MS;
    }

    if (prev) {
      const prevHowl = (prev.battle ? battleHowlsRef.current : ambientHowlsRef.current)[prev.zone];
      if (prevHowl) {
        const fromVol = prev.battle ? BATTLE_VOLUME : AMBIENT_VOLUME;
        prevHowl.fade(fromVol, 0, fadeMs);
        setTimeout(() => {
          if (!keyEq(activeTrackRef.current, prev)) {
            prevHowl.stop();
          }
        }, fadeMs + 50);
      }
    }

    const nextHowl = getHowl(desired.zone, desired.battle);
    if (nextHowl) {
      const toVol = desired.battle ? BATTLE_VOLUME : AMBIENT_VOLUME;
      console.log('[SoundContext] play()', { desired, fadeMs, toVol, ctxState: Howler.ctx?.state });
      nextHowl.volume(0);
      nextHowl.play();
      nextHowl.fade(0, toVol, fadeMs);
      activeTrackRef.current = desired;
    } else {
      console.warn('[SoundContext] no Howl returned for', desired);
      activeTrackRef.current = desired;
    }
  }, [soundEnabled, currentZone, battleMode, getHowl]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      for (const howl of Object.values(ambientHowlsRef.current)) howl.unload();
      for (const howl of Object.values(battleHowlsRef.current)) howl.unload();
      ambientHowlsRef.current = {};
      battleHowlsRef.current = {};
      activeTrackRef.current = null;
    };
  }, []);

  const toggleSound = useCallback(() => {
    // Resume the audio context synchronously here — the click handler is a
    // user gesture, so the browser will honor resume(). Doing it inside the
    // subsequent playback useEffect happens one microtask later, which some
    // browsers treat as outside the gesture window and refuse to unlock.
    if (Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume().catch(() => {});
    }
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_ENABLED_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
};
