import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';

import { useAuth } from './AuthContext';
import { useMap } from './MapContext';

const SOUND_ENABLED_KEY = 'ud:sound-enabled';
const SOUND_AUTO_STARTED_KEY = 'ud:sound-auto-started';
const AMBIENT_VOLUME = 0.25;
const CROSSFADE_MS = 2000;

/** Map zone IDs to their background audio files */
const ZONE_AUDIO: Record<number, string> = {
  1: '/audio/dark-cave-mix.ogg',
  2: '/audio/windy-peaks-mix.ogg',
};

type SoundContextValue = {
  soundEnabled: boolean;
  toggleSound: () => void;
};

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: false,
  toggleSound: () => {},
});

export const useGameAudio = () => useContext(SoundContext);

export const SoundProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const { currentZone } = useMap();

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  });

  /** Cache of Howl instances by zone ID — created lazily, reused across transitions */
  const howlsRef = useRef<Record<number, Howl>>({});
  /** The zone ID that is currently playing */
  const activeZoneRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);

  /** Get or create a Howl for a zone */
  const getHowl = useCallback((zoneId: number): Howl | null => {
    const src = ZONE_AUDIO[zoneId];
    if (!src) return null;

    if (!howlsRef.current[zoneId]) {
      howlsRef.current[zoneId] = new Howl({
        src: [src],
        loop: true,
        volume: 0,
        preload: true,
      });
    }
    return howlsRef.current[zoneId];
  }, []);

  // Auto-enable sound when user authenticates (once per session)
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

  // Handle zone changes and sound toggle — crossfade between zone tracks
  useEffect(() => {
    if (!soundEnabled) {
      // Stop all playing tracks
      for (const howl of Object.values(howlsRef.current)) {
        howl.stop();
      }
      activeZoneRef.current = null;
      return;
    }

    // Sound is enabled — play the correct zone track
    if (activeZoneRef.current === currentZone) return;

    // Fade out the old zone track
    const oldZone = activeZoneRef.current;
    if (oldZone !== null) {
      const oldHowl = howlsRef.current[oldZone];
      if (oldHowl) {
        oldHowl.fade(AMBIENT_VOLUME, 0, CROSSFADE_MS);
        // Stop after fade completes to free resources
        setTimeout(() => {
          // Only stop if this zone is still not the active one
          if (activeZoneRef.current !== oldZone) {
            oldHowl.stop();
          }
        }, CROSSFADE_MS + 50);
      }
    }

    // Fade in the new zone track
    const newHowl = getHowl(currentZone);
    if (newHowl) {
      newHowl.volume(0);
      newHowl.play();
      newHowl.fade(0, AMBIENT_VOLUME, CROSSFADE_MS);
      activeZoneRef.current = currentZone;
    }
  }, [soundEnabled, currentZone, getHowl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const howl of Object.values(howlsRef.current)) {
        howl.unload();
      }
      howlsRef.current = {};
      activeZoneRef.current = null;
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
