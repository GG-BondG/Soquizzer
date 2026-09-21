import { useCallback, useEffect, useRef, useState } from 'react';
import { randomItem } from './random.js';

const OPTION_MOTIONS = ['motion-pop', 'motion-ripple', 'motion-tilt'];
const MOTION_MS = 450;

// The little animation on the option the student just picked: { questionId, optionIndex, name } for a moment.
export function useOptionMotion() {
  const timer = useRef(null);
  const [optionMotion, setOptionMotion] = useState(null);

  const clearOptionMotion = useCallback(() => {
    clearTimeout(timer.current);
    setOptionMotion(null);
  }, []);

  const playOptionMotion = useCallback((questionId, optionIndex) => {
    clearTimeout(timer.current);
    setOptionMotion({ questionId, optionIndex, name: randomItem(OPTION_MOTIONS) });
    timer.current = setTimeout(() => setOptionMotion(null), MOTION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { optionMotion, playOptionMotion, clearOptionMotion };
}
