import { useCallback, useEffect, useRef, useState } from 'react';

const BUBBLE_MS = 3500;

// The pet's speech bubble. `showBubble(text)` fades after BUBBLE_MS unless `sticky` (used while waiting on the backend).
export function useBubble() {
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);

  const showBubble = useCallback((text, { sticky = false } = {}) => {
    clearTimeout(hideTimer.current);
    setBubble(text);
    if (!sticky) hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  const clearBubble = useCallback(() => setBubble(null), []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return { bubble, showBubble, clearBubble };
}
