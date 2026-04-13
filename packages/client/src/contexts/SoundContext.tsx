import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';

import { useAuth } from './AuthContext';
import { useBattle } from './BattleContext';
import { useMap } from './MapContext';

const SOUND_ENABLED_KEY = 'ud:sound-enabled';
const SOUND_AUTO_STARTED_KEY = 'ud:sound-auto-started';
const AMBIENT_VOLUME = 0.25;
const BATTLE_VOLUME = 0.3;
const DUCK_VOLUME_FACTOR = 0.5;
const DUCK_FADE_OUT_MS = 300;
const DUCK_FADE_IN_MS = 800;

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

export type SfxKey =
  | 'battle-hit-sword'
  | 'battle-hit-hammer'
  | 'battle-hit-arrow'
  | 'battle-hit-magic'
  | 'battle-crit'
  | 'battle-kill'
  | 'battle-miss'
  | 'battle-dodge'
  | 'battle-take-damage'
  | 'player-death'
  | 'battle-win'
  | 'level-up'
  | 'loot-rare'
  | 'loot-epic'
  | 'fragment-trigger'
  | 'fragment-claim';

type SfxConfig = {
  src: string;
  volume: number;
};

const sfxManifest: Partial<Record<SfxKey, SfxConfig>> = {
  'battle-hit-sword': { src: '/audio/sfx/battle/battle-hit-sword.ogg', volume: 0.55 },
  'battle-hit-hammer': { src: '/audio/sfx/battle/battle-hit-hammer.ogg', volume: 0.55 },
  'battle-hit-arrow': { src: '/audio/sfx/battle/battle-hit-arrow.ogg', volume: 0.55 },
  'battle-hit-magic': { src: '/audio/sfx/battle/battle-hit-magic.ogg', volume: 0.55 },
  'battle-crit': { src: '/audio/sfx/battle/battle-crit.ogg', volume: 0.65 },
  'battle-kill': { src: '/audio/sfx/battle/battle-kill.ogg', volume: 0.75 },
  // Pending sourced files:
  // 'battle-miss': { src: '/audio/sfx/battle/battle-miss.ogg', volume: 0.45 },
  // 'battle-dodge': { src: '/audio/sfx/battle/battle-dodge.ogg', volume: 0.45 },
  // 'battle-take-damage': { src: '/audio/sfx/battle/battle-take-damage.ogg', volume: 0.60 },
  'player-death': { src: '/audio/sfx/battle/player-death.ogg', volume: 0.75 },
  'battle-win': { src: '/audio/sfx/battle/battle-win.ogg', volume: 0.75 },
  'level-up': { src: '/audio/sfx/level/level-up.ogg', volume: 0.80 },
  'loot-rare': { src: '/audio/sfx/loot/loot-rare.ogg', volume: 0.65 },
  'loot-epic': { src: '/audio/sfx/loot/loot-epic.ogg', volume: 0.75 },
  'fragment-trigger': { src: '/audio/sfx/fragment/fragment-trigger.ogg', volume: 0.60 },
  'fragment-claim': { src: '/audio/sfx/fragment/fragment-claim.ogg', volume: 0.60 },
};

type TrackKey = { zone: number; battle: boolean };

// Module-scoped audio state — survives React provider remounts.
// MUDProvider swaps its internal component type when setupPromise resolves,
// which unmounts the entire SoundProvider subtree and would otherwise destroy
// Howls mid-load, leaving audio silent after a hard refresh.
const ambientHowls: Record<number, Howl> = {};
const battleHowls: Record<number, Howl> = {};
const sfxHowls: Partial<Record<SfxKey, Howl>> = {};
let activeTrack: TrackKey | null = null;
const missingZoneWarned: Set<string> = new Set();
let duckTimer: ReturnType<typeof setTimeout> | null = null;

export const __resetSoundForTests = (): void => {
  for (const key of Object.keys(ambientHowls)) delete ambientHowls[Number(key)];
  for (const key of Object.keys(battleHowls)) delete battleHowls[Number(key)];
  for (const key of Object.keys(sfxHowls)) delete sfxHowls[key as SfxKey];
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
  }
  activeTrack = null;
  missingZoneWarned.clear();
};

type SoundContextValue = {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSfx: (key: SfxKey) => void;
  duckMusic: (durationMs: number) => void;
};

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: false,
  toggleSound: () => {},
  playSfx: () => {},
  duckMusic: () => {},
});

export const useGameAudio = (): SoundContextValue => useContext(SoundContext);

const keyEq = (a: TrackKey | null, b: TrackKey | null) =>
  a !== null && b !== null && a.zone === b.zone && a.battle === b.battle;

const getHowl = (zoneId: number, battle: boolean): Howl | null => {
  const map = battle ? BATTLE_AUDIO : ZONE_AUDIO;
  const cache = battle ? battleHowls : ambientHowls;
  let src = map[zoneId];
  let resolvedZone = zoneId;

  if (!src) {
    const warnKey = `${battle ? 'battle' : 'ambient'}:${zoneId}`;
    if (!missingZoneWarned.has(warnKey)) {
      missingZoneWarned.add(warnKey);
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
    cache[resolvedZone] = new Howl({
      src: [src],
      loop: true,
      volume: 0,
      preload: true,
      onloaderror: (_id, err) => console.error('[SoundContext] onloaderror', src, err),
      onplayerror: (_id, err) => console.error('[SoundContext] onplayerror', src, err),
    });
  }
  return cache[resolvedZone];
};

const getSfxHowl = (key: SfxKey): Howl | null => {
  const config = sfxManifest[key];
  if (!config) return null;

  if (!sfxHowls[key]) {
    sfxHowls[key] = new Howl({
      src: [config.src],
      loop: false,
      volume: config.volume,
      preload: true,
      onloaderror: (_id, err) => console.error('[SoundContext] SFX onloaderror', config.src, err),
      onplayerror: (_id, err) => console.error('[SoundContext] SFX onplayerror', config.src, err),
    });
  }

  return sfxHowls[key] ?? null;
};

const getTrackBaseVolume = (track: TrackKey): number =>
  track.battle ? BATTLE_VOLUME : AMBIENT_VOLUME;

const getActiveHowl = (): Howl | null => {
  if (!activeTrack) return null;
  return (activeTrack.battle ? battleHowls : ambientHowls)[activeTrack.zone] ?? null;
};

export const SoundProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const { currentZone } = useMap();
  const { currentBattle } = useBattle();

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  });

  // True while a fight is live OR while lingering after a fight just ended.
  // Initialize from currentBattle so we don't flash ambient music for one tick
  // when the player loads the page mid-combat.
  const [battleMode, setBattleMode] = useState(() => currentBattle !== null);

  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartedRef = useRef(false);

  const inCombat = currentBattle !== null;

  useEffect(() => {
    for (const key of Object.keys(sfxManifest) as SfxKey[]) {
      getSfxHowl(key);
    }
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
  // Howler has its own auto-unlock but in practice it doesn't always flush
  // queued plays reliably, so we also nudge the active Howl back on.
  useEffect(() => {
    if (!soundEnabled) return;

    const unlock = () => {
      const ctx = Howler.ctx;
      if (ctx && ctx.state !== 'running') {
        ctx.resume().catch((err) => console.error('[SoundContext] ctx.resume failed', err));
      }
      if (activeTrack) {
        const cache = activeTrack.battle ? battleHowls : ambientHowls;
        const howl = cache[activeTrack.zone];
        if (howl && !howl.playing()) {
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
    if (!soundEnabled) {
      for (const howl of Object.values(ambientHowls)) howl.stop();
      for (const howl of Object.values(battleHowls)) howl.stop();
      if (duckTimer) {
        clearTimeout(duckTimer);
        duckTimer = null;
      }
      activeTrack = null;
      return;
    }

    const desired: TrackKey = { zone: currentZone, battle: battleMode };
    if (keyEq(activeTrack, desired)) {
      return;
    }

    const prev = activeTrack;

    // Pick crossfade timing from the transition type.
    let fadeMs = ZONE_CROSSFADE_MS;
    if (prev) {
      if (!prev.battle && desired.battle) fadeMs = BATTLE_ENTER_CROSSFADE_MS;
      else if (prev.battle && !desired.battle) fadeMs = BATTLE_EXIT_CROSSFADE_MS;
    }

    if (prev) {
      const prevHowl = (prev.battle ? battleHowls : ambientHowls)[prev.zone];
      if (prevHowl) {
        const fromVol = prev.battle ? BATTLE_VOLUME : AMBIENT_VOLUME;
        prevHowl.fade(fromVol, 0, fadeMs);
        setTimeout(() => {
          if (!keyEq(activeTrack, prev)) {
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
      activeTrack = desired;
    } else {
      activeTrack = desired;
    }
  }, [soundEnabled, currentZone, battleMode]);

  // Cleanup on unmount — only the linger timer needs cleanup. The module-level
  // Howl cache intentionally survives remounts so audio keeps playing through
  // parent provider swaps.
  useEffect(() => {
    return () => {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
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

  const playSfx = useCallback((key: SfxKey) => {
    if (!soundEnabled) return;
    const config = sfxManifest[key];
    const howl = getSfxHowl(key);
    if (!config || !howl) return;

    howl.volume(config.volume);
    howl.play();
  }, [soundEnabled]);

  const duckMusic = useCallback((durationMs: number) => {
    if (!soundEnabled || durationMs <= 0) return;
    const track = activeTrack;
    const howl = getActiveHowl();
    if (!track || !howl) return;

    if (duckTimer) {
      clearTimeout(duckTimer);
      duckTimer = null;
    }

    const baseVolume = getTrackBaseVolume(track);
    howl.fade(baseVolume, baseVolume * DUCK_VOLUME_FACTOR, DUCK_FADE_OUT_MS);
    duckTimer = setTimeout(() => {
      const currentHowl = getActiveHowl();
      if (currentHowl && keyEq(activeTrack, track)) {
        currentHowl.fade(baseVolume * DUCK_VOLUME_FACTOR, baseVolume, DUCK_FADE_IN_MS);
      }
      duckTimer = null;
    }, Math.max(0, durationMs - DUCK_FADE_IN_MS));
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSfx, duckMusic }}>
      {children}
    </SoundContext.Provider>
  );
};
