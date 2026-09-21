import { useMemo } from 'react';
import { buildPowerHistory, POWER_AXES, pointsAttr, radarPoints } from '../power.js';
import './PowerRadar.css';

const SIZE = { width: 340, height: 300 };
const CENTER = { x: SIZE.width / 2, y: 152 };
const RADIUS = 92;
const LABEL_GAP = 22;
const RINGS = [25, 50, 75, 100];
const TRAIL = 4; // how many earlier quizzes stay drawn, fading with age

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

function labelAnchor(x) {
  if (x < CENTER.x - 4) return 'end';
  if (x > CENTER.x + 4) return 'start';
  return 'middle';
}

// `history` is the result of useApi(() => api.history.list(...)), shared with the activity heatmap.
export default function PowerRadar({ history }) {
  const { data, error, loading, reload } = history;
  const attempts = data?.attempts;
  const snapshots = useMemo(() => buildPowerHistory(attempts), [attempts]);

  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.at(-2) ?? null;
  const trail = snapshots.slice(-(TRAIL + 1), -1);

  const latestValues = latest ? POWER_AXES.map(({ key }) => latest.scores[key]) : null;
  const delta = latest && previous ? latest.power - previous.power : null;

  const summary = latest
    ? `Power ${latest.power}. ${POWER_AXES.map(({ key, label }) => `${label} ${latest.scores[key]}`).join(', ')}.`
    : 'Power chart. Finish a quiz to fill it in.';

  const corners = (values, radius) => radarPoints(values, CENTER.x, CENTER.y, radius);

  return (
    <section className="power" aria-label="Study power">
      <div className="power-head">
        <div className="menu-label power-label">Study power</div>
        {latest && (
          <div className="power-total" aria-hidden="true">
            <span className="power-number">{latest.power}</span>
            {delta !== null && (
              <span className={`power-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
                {delta === 0 ? 'no change' : `${signed(delta)} since last quiz`}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="status-note">
          Could not load your power.{' '}
          <button type="button" className="btn btn-small" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {loading && !data && !error && <div className="status-note">Loading power…</div>}

      {data && (
        <>
          <svg className="power-chart" viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} role="img" aria-label={summary}>
            {RINGS.map((ring) => (
              <polygon
                key={ring}
                className={`power-ring ${ring === 100 ? 'is-outer' : ''}`}
                points={pointsAttr(corners(POWER_AXES.map(() => ring), RADIUS))}
              />
            ))}
            {corners(POWER_AXES.map(() => 100), RADIUS).map((p, i) => (
              <line key={i} className="power-axis" x1={CENTER.x} y1={CENTER.y} x2={p.x} y2={p.y} />
            ))}

            {trail.map((snapshot, i) => (
              <polygon
                key={snapshot.attemptId}
                className="power-trail"
                style={{ opacity: 0.18 + (0.32 * (i + 1)) / trail.length }}
                points={pointsAttr(corners(POWER_AXES.map(({ key }) => snapshot.scores[key]), RADIUS))}
              />
            ))}

            {latest && (
              // keyed by the attempt, so a newer quiz draws its line again
              <g key={latest.attemptId}>
                <polygon className="power-latest-fill" points={pointsAttr(corners(latestValues, RADIUS))} />
                <polygon className="power-latest" pathLength="1" points={pointsAttr(corners(latestValues, RADIUS))} />
                {corners(latestValues, RADIUS).map((p, i) => (
                  <circle key={i} className="power-dot" cx={p.x} cy={p.y} r="3.5" />
                ))}
              </g>
            )}

            {POWER_AXES.map(({ key, label }, i) => {
              const p = corners(POWER_AXES.map(() => 100), RADIUS + LABEL_GAP)[i];
              const axisDelta = latest && previous ? latest.scores[key] - previous.scores[key] : 0;
              return (
                <text
                  key={key}
                  className="power-axis-label"
                  x={p.x}
                  y={p.y}
                  textAnchor={labelAnchor(p.x)}
                  dominantBaseline="middle"
                  aria-hidden="true"
                >
                  <tspan x={p.x} dy="-0.5em">
                    {label}
                  </tspan>
                  <tspan x={p.x} dy="1.25em" className="power-axis-value">
                    {latest ? latest.scores[key] : '–'}
                    {axisDelta !== 0 && (
                      <tspan className={axisDelta > 0 ? 'is-up' : 'is-down'}> {signed(axisDelta)}</tspan>
                    )}
                  </tspan>
                </text>
              );
            })}
          </svg>

          <div className="power-foot">
            {latest ? (
              <div className="power-legend" aria-hidden="true">
                <span className="power-key is-latest" /> Latest quiz
                {trail.length > 0 && (
                  <>
                    <span className="power-key is-trail" /> Earlier
                  </>
                )}
              </div>
            ) : (
              <div className="status-note power-empty">Finish a quiz and your first line will appear here.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
