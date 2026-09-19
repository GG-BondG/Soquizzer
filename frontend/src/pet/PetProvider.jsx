import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Live2DPet from './Live2DPet.jsx';
import { CORRECT_LINES, pickLine } from './encouragements.js';

const BUBBLE_MS = 3500;

const noop = () => {};
const PetContext = createContext({ cheer: noop, loading: noop, success: noop, error: noop, idle: noop });

// The pet lives above the router so it stays on screen while the student moves between pages.
export function PetProvider({ children }) {
  const petRef = useRef(null);
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);

  // Show `text` in the bubble; it fades after BUBBLE_MS unless `sticky` (used while waiting on the backend).
  const showBubble = useCallback((text, { sticky = false } = {}) => {
    clearTimeout(hideTimer.current);
    setBubble(text);
    if (!sticky) hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  // Call when the student answers correctly: a random encouraging line, in text and (if the clip exists) voice.
  const cheer = useCallback(() => {
    const line = pickLine(CORRECT_LINES, lastLineId.current);
    lastLineId.current = line.id;
    showBubble(line.text);
    petRef.current?.perform(`${import.meta.env.BASE_URL}voice/${line.id}.wav`);
  }, [showBubble]);

  const value = useMemo(
    () => ({
      cheer,
      // Status messages for backend work. `loading` stays until the next message replaces it.
      loading: (text) => showBubble(text, { sticky: true }),
      success: (text) => showBubble(text),
      error: (text) => showBubble(text),
      idle: (text) => (text ? showBubble(text) : showBubble(null, { sticky: true })),
    }),
    [cheer, showBubble]
  );

  return (
    <PetContext.Provider value={value}>
      {children}
      <Live2DPet ref={petRef} bubble={bubble} />
    </PetContext.Provider>
  );
}

export function usePet() {
  return useContext(PetContext);
}
