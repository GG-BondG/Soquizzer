import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// State for the study pet (ported from the feature/pet-ui branch). Screens call
// pet.loading(...) while waiting on the backend and pet.success(...) or
// pet.error(...) when it comes back; the pet then settles back to idle, and
// falls asleep after a while without pointer or keyboard activity.

const IDLE_MESSAGE = 'Hi! I am your study buddy.';
const SETTLE_MS = 5000;
const SLEEP_AFTER_MS = 30_000;

const PetContext = createContext(null);

export function PetProvider({ children }) {
  const [pet, setPet] = useState({ mood: 'idle', message: IDLE_MESSAGE });
  const settleTimer = useRef(null);
  const sleepTimer = useRef(null);

  const say = useCallback((mood, message) => {
    clearTimeout(settleTimer.current);
    setPet({ mood, message });
    if (mood === 'success' || mood === 'error') {
      settleTimer.current = setTimeout(() => setPet({ mood: 'idle', message: IDLE_MESSAGE }), SETTLE_MS);
    }
  }, []);

  useEffect(() => {
    function onActivity() {
      setPet((p) => (p.mood === 'sleeping' ? { mood: 'idle', message: 'I am awake again!' } : p));
      clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => {
        setPet((p) => (p.mood === 'idle' ? { mood: 'sleeping', message: 'Zzz... I am resting while you think.' } : p));
      }, SLEEP_AFTER_MS);
    }
    onActivity();
    window.addEventListener('pointermove', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
      clearTimeout(sleepTimer.current);
      clearTimeout(settleTimer.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      ...pet,
      loading: (message) => say('loading', message),
      success: (message) => say('success', message),
      error: (message) => say('error', message),
      idle: (message) => say('idle', message ?? IDLE_MESSAGE),
    }),
    [pet, say]
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet() {
  return useContext(PetContext);
}
