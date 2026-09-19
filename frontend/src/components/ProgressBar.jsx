import './ProgressBar.css';

// A thin bar for work that takes a while. `value` is 0..1. Spans only, so it can sit inside a button.
// Color comes from --progress-color (default: the app's green), so a Trivia or Mock Test window can tint it.
export default function ProgressBar({ value, label, className = '' }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span
      className={`progress ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="progress-fill" style={{ width: `${percent}%` }} />
    </span>
  );
}
