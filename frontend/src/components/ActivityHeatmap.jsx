import { useMemo } from 'react';
import { api } from '../api.js';
import { ACTIVITY_WEEKS, buildActivity } from '../activity.js';
import { useApi } from '../useApi.js';
import './ActivityHeatmap.css';

const MAX_ATTEMPTS = 200; // the most GET /api/history returns
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function monthLabels(weeks) {
  const labels = weeks.map((week, i) => {
    const first = week.find(Boolean)?.date;
    const prev = i > 0 ? weeks[i - 1].find(Boolean)?.date : null;
    if (!first) return '';
    if (prev && prev.getMonth() === first.getMonth()) return '';
    return first.toLocaleString(undefined, { month: 'short' });
  });
  // a two-week sliver of the oldest month would print on top of the next label
  if (labels[0] && labels[1]) labels[0] = '';
  return labels;
}

function cellTitle({ count, date }) {
  const when = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${count === 0 ? 'No quizzes' : `${count} ${count === 1 ? 'quiz' : 'quizzes'}`} on ${when}`;
}

export default function ActivityHeatmap() {
  const { data, error, loading, reload } = useApi(() => api.history.list({ limit: MAX_ATTEMPTS }), []);
  const attempts = data?.attempts;
  const { weeks, total } = useMemo(() => buildActivity(attempts), [attempts]);
  const months = useMemo(() => monthLabels(weeks), [weeks]);

  return (
    <section className="activity" aria-label="Quiz activity">
      <div className="activity-head">
        <div className="menu-label activity-label">
          {data ? `${total} ${total === 1 ? 'quiz' : 'quizzes'} in the last ${ACTIVITY_WEEKS} weeks` : 'Quiz activity'}
        </div>
        <div className="activity-legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={`activity-cell level-${level}`} />
          ))}
          More
        </div>
      </div>

      {error && (
        <div className="status-note">
          Could not load your activity.{' '}
          <button type="button" className="btn btn-small" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {loading && !data && !error && <div className="status-note">Loading activity…</div>}

      {data && (
        <div className="activity-scroll">
          <div className="activity-grid">
            <div className="activity-days" aria-hidden="true">
              {DAY_LABELS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            {weeks.map((week, w) => (
              <div className="activity-week" key={w}>
                <span className="activity-month" aria-hidden="true">
                  {months[w]}
                </span>
                {week.map((day, d) =>
                  day ? (
                    <span key={day.key} className={`activity-cell level-${day.level}`} title={cellTitle(day)} />
                  ) : (
                    <span key={d} className="activity-cell empty" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
