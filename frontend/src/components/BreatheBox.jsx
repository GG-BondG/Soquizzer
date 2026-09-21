import { useEffect, useState } from 'react';
import './BreatheBox.css';

const PHASE_MS = 4000; // four seconds in, four seconds out

// A slow breathing circle for a short break between quizzes. Everything runs off one timer, so the words and the
// circle (a CSS transition on the `is-in` class) always agree.
export default function BreatheBox() {
  const [active, setActive] = useState(false);
  const [inhaling, setInhaling] = useState(false);
  const [breaths, setBreaths] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    setInhaling(true);
    let flips = 0;
    const timer = setInterval(() => {
      flips += 1;
      setInhaling(flips % 2 === 0);
      if (flips % 2 === 0) setBreaths((n) => n + 1); // an exhale just finished
    }, PHASE_MS);
    return () => clearInterval(timer);
  }, [active]);

  function toggle() {
    if (active) {
      setActive(false);
      setInhaling(false);
    } else {
      setBreaths(0);
      setActive(true);
    }
  }

  const words = !active ? 'Take a breath' : inhaling ? 'Breathe in…' : 'Breathe out…';
  const note = !active
    ? 'Quizzes will wait.'
    : breaths === 0
      ? 'Follow the circle.'
      : `${breaths} ${breaths === 1 ? 'breath' : 'breaths'} · nice and slow`;

  return (
    <div className="breathe">
      <button
        type="button"
        className={`breathe-orb ${inhaling ? 'is-in' : ''} ${active ? 'is-active' : ''}`}
        onClick={toggle}
        aria-pressed={active}
        aria-label={active ? 'Stop breathing exercise' : 'Start breathing exercise'}
      >
        <span className="breathe-core" aria-hidden="true" />
      </button>
      <div className="breathe-text">
        <div className="breathe-words" aria-live="polite">
          {words}
        </div>
        <div className="breathe-note">{note}</div>
      </div>
    </div>
  );
}
