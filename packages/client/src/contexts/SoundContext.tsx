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
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  });

  // True while a fight is live OR while lingering after a fight just ended.
  const [battleMode, setBattleMode] = useState(false);

  const ambientHowlsRef = useRef<Record<number, Howl>>({});
  const battleHowlsRef = useRef<Record<number, Howl>>({});
  const activeTrackRef = useRef<TrackKey | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartedRef = useRef(false);

  const inCombat = currentBattle !== null;

  const getHowl = useCallback((zoneId: number, battle: boolean): Howl | null => {
    const map = battle ? BATTLE_AUDIO : ZONE_AUDIO;
    const cache = battle ? battleHowlsRef.current : ambientHowlsRef.current;
    const src = map[zoneId];
    if (!src) return null;

    if (!cache[zoneId]) {
      cache[zoneId] = new Howl({
        src: [src],
        loop: true,
        volume: 0,
        preload: true,
      });
    }
    return cache[zoneId];
  }, []);

  // Auto-enable sound when user authenticates (once per session).
  useEffect(() => {
    if (
      isAuthenticated &&
      !soundEnabled &&
      !autoStartedRef.current &&
      sessionStorage.getItem(SOUND_AUTO_STARTED_KEY) !== '1'
    ) {
      autoStartedRef.current = true;
      sessionStorage.setItem(SOUND_AUTO_STARTED_KEY, '1');
      setSoundEnabled(true);
      localStorage.setItem(SOUND_ENABLED_KEY, 'true');
    }
  }, [isAuthenticated, soundEnabled]);

  // Autoplay unlock: browsers suspend the audio context until a user gesture.
  // Auto-enabling sound on auth doesn't count as a gesture — without this, the
  // first ambient track queues silently and never plays until the player clicks
  // something. Resume on the next pointer/key/touch event, once.
  useEffect(() => {
    if (!soundEnabled) return;
    const ctx = Howler.ctx;
    if (!ctx || ctx.state === 'running') return;

    const unlock = () => {
      Howler.ctx?.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
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
    if (!soundEnabled) {
      for (const howl of Object.values(ambientHowlsRef.current)) howl.stop();
      for (const howl of Object.values(battleHowlsRef.current)) howl.stop();
      activeTrackRef.current = null;
      return;
    }

    const desired: TrackKey = { zone: currentZone, battle: battleMode };
    if (keyEq(activeTrackRef.current, desired)) return;

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
      nextHowl.volume(0);
      nextHowl.play();
      nextHowl.fade(0, toVol, fadeMs);
      activeTrackRef.current = desired;
    } else {
      // No track for this zone — go silent but remember what we wanted so the
      // next change still fires a transition.
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
