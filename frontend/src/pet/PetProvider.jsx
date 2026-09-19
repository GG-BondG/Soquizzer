import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Live2DPet from './Live2DPet.jsx';
import { CORRECT_LINES, pickLine } from './encouragements.js';

const BUBBLE_MS = 3500;

const PetContext = createContext({ cheer: () => {} });

// The pet lives above the router so it stays on screen while the student moves between pages.
export function PetProvider({ children }) {
  const petRef = useRef(null);
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);

  // Call when the student answers correctly: a random encouraging line, in text and (if the clip exists) voice.
  const cheer = useCallback(() => {
    const line = pickLine(CORRECT_LINES, lastLineId.current);
    lastLineId.current = line.id;
    setBubble(line.text);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
    petRef.current?.perform(`${import.meta.env.BASE_URL}voice/${line.id}.wav`);
  }, []);

  const value = useMemo(() => ({ cheer }), [cheer]);

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
