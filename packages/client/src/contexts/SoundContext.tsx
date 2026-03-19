import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';

import { useAuth } from './AuthContext';

const SOUND_ENABLED_KEY = 'ud:sound-enabled';
const SOUND_AUTO_STARTED_KEY = 'ud:sound-auto-started';
const AMBIENT_VOLUME = 0.25;

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

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  });

  const ambientRef = useRef<Howl | null>(null);
  const autoStartedRef = useRef(false);

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

  // Lazy-init and play/stop ambient based on soundEnabled
  useEffect(() => {
    if (soundEnabled) {
      if (!ambientRef.current) {
        ambientRef.current = new Howl({
          src: ['/audio/cave-melody.ogg'],
          loop: true,
          volume: AMBIENT_VOLUME,
          preload: true,
        });
      }
      ambientRef.current.play();
    } else {
      ambientRef.current?.stop();
    }
  }, [soundEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ambientRef.current?.unload();
      ambientRef.current = null;
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
