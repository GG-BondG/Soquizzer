import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, formatDuration, formatPercent } from '../format.js';
import { useApi } from '../useApi.js';
import { BackIcon, ChevronIcon } from './Icons.jsx';
import './HistoryPage.css';

export default function HistoryPage() {
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const courses = useApi(() => api.courses.list(), []);
  // the section filter only makes sense within one course
  const sections = useApi(() => (courseId ? api.sections.list(courseId) : []), [courseId]);
  const history = useApi(() => api.history.list({ courseId, sectionId }), [courseId, sectionId]);

  function pickCourse(id) {
    setCourseId(id);
    setSectionId('');
  }

  const summary = history.data?.summary;
  const attempts = history.data?.attempts ?? [];

  return (
    <div className="page detail-page">
      <Link to="/" className="back-link">
        <BackIcon /> Courses
      </Link>

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">History</span>
        </div>
        <div className="history-filters">
          <select value={courseId} onChange={(e) => pickCourse(e.target.value)} aria-label="Filter by course">
            <option value="">All courses</option>
            {(courses.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!courseId}
            aria-label="Filter by section"
          >
            <option value="">All sections</option>
            {(sections.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(history.error || courses.error) && (
        <div className="error-note">
          {(history.error ?? courses.error).message}
          <div>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                history.reload();
                courses.reload();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{summary ? summary.attempts : '-'}</div>
          <div className="stat-label">Attempts</div>
        </div>
        <div className="stat">
          <div className="stat-value">{summary ? formatPercent(summary.accuracy) : '-'}</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat">
          <div className="stat-value">{summary ? formatDuration(summary.total_time_seconds) : '-'}</div>
          <div className="stat-label">Total time</div>
        </div>
      </div>

      <div className="block">
        <div className="block-header">
          <div className="block-label">Attempts</div>
          {history.data && <div className="block-count">latest {attempts.length}</div>}
        </div>

        {history.loading && !history.data && <div className="status-note">Loading…</div>}

        {attempts.length > 0 && (
          <div className="row-list">
            {attempts.map((a) => (
              <div className="row" key={a.attempt_id}>
                <Link to={`/attempts/${a.attempt_id}`} className="row-link">
                  <span className="row-title">
                    {a.course_name}
                    <span className="history-section"> · {a.section_name}</span>
                  </span>
                  <span className="row-meta">{formatDate(a.submitted_at, { time: true })}</span>
                  <span className="row-mono history-col">
                    {a.score}/{a.total}
                  </span>
                  <span className="row-mono history-col">{formatPercent(a.accuracy)}</span>
                  <span className="row-mono history-col">{formatDuration(a.time_spent_seconds)}</span>
                  <ChevronIcon stroke="var(--text-3)" />
                </Link>
              </div>
            ))}
          </div>
        )}
        {history.data && attempts.length === 0 && (
          <div className="empty-note">
            {courseId ? 'No attempts match this filter.' : 'No attempts yet. Finish a quiz and it will show up here.'}
          </div>
        )}
      </div>
    </div>
  );
}
