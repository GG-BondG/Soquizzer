import { useEffect, useState } from 'react';
import './FloatingWindow.css';

const SCALE = 0.67; // window size relative to the app window

function targetRect() {
  const width = window.innerWidth * SCALE;
  const height = window.innerHeight * SCALE;
  return {
    top: (window.innerHeight - height) / 2,
    left: (window.innerWidth - width) / 2,
    width,
    height,
    radius: 16,
  };
}

// A window that grows out of `originRef` (any element) into a centered floating
// window over a dimmed backdrop, and shrinks back on close. The parent owns
// `open`; `collapsed` is what the origin element shows, mirrored inside the
// window so the shrink-back lands seamlessly. `children` is the window content.
export default function FloatingWindow({ originRef, open, onClose, collapsed, originRadius = 12, children }) {
  const [mounted, setMounted] = useState(false); // in the DOM at all
  const [rect, setRect] = useState(null); // current animated rect

  function measureOrigin() {
    const r = originRef.current.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, radius: originRadius };
  }

  useEffect(() => {
    if (open) {
      // paint at the origin's rect first, then animate to the window on the next frame
      setRect(measureOrigin());
      setMounted(true);
      let raf2;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setRect(targetRect()));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (mounted) setRect(measureOrigin());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the target rect correct if the app window is resized
  useEffect(() => {
    if (!mounted) return;
    function onResize() {
      setRect(open ? targetRect() : measureOrigin());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleTransitionEnd(e) {
    // ignore the fades of child elements bubbling up; only the window's own resize counts
    if (e.target === e.currentTarget && e.propertyName === 'width' && !open) setMounted(false);
  }

  if (!mounted) return null;

  return (
    <>
      <div className={`modal-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} />
      <div
        className={`floating-window ${open ? 'is-open' : ''}`}
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div aria-hidden="true" className={`panel-face panel-face-collapsed ${open ? 'is-hidden' : ''}`}>
          <span className="collapsed-content">{collapsed}</span>
        </div>
        <div className={`panel-face panel-face-form ${open ? 'is-visible' : ''}`}>{children}</div>
      </div>
    </>
  );
}
