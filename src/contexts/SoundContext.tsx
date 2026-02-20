import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { playSound as playSoundRaw, resumeAudioContext, isMuted as checkMuted, setMuted as saveMuted, SoundType } from '../hooks/useSound';

interface SoundContextValue {
  playSound: (type: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextValue>({
  playSound: () => {},
  isMuted: false,
  toggleMute: () => {},
});

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(() => checkMuted());

  // Unlock AudioContext on first user gesture (required for iOS)
  useEffect(() => {
    const unlock = () => resumeAudioContext();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      saveMuted(next);
      return next;
    });
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!muted) {
      playSoundRaw(type);
    }
  }, [muted]);

  return (
    <SoundContext.Provider value={{ playSound, isMuted: muted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
