import { useEffect } from 'react';
import './ConfirmDialog.css';

// A small centered confirmation for destructive actions. Render it conditionally
// (or pass `open`); `busy` disables the buttons while the request is in flight.
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Delete', busy = false, error, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop is-open" onClick={busy ? undefined : onCancel} />
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="confirm-title">{title}</div>
        <div className="confirm-body">{children}</div>
        {error && <div className="error-note">{error}</div>}
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
