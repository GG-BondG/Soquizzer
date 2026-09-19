import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, formatDuration, formatPercent } from '../format.js';
import { useApi } from '../useApi.js';
import { BackIcon } from './Icons.jsx';
import QuestionReview from './QuestionReview.jsx';
import './HistoryPage.css';

export default function AttemptDetail() {
  const { attemptId } = useParams();
  const attempt = useApi(() => api.history.attempt(attemptId), [attemptId]);

  const back = (
    <Link to="/history" className="back-link">
      <BackIcon /> History
    </Link>
  );

  if (attempt.error) {
    return (
      <div className="page">
        {back}
        <div className="error-note">
          {attempt.error.status === 404 ? 'This attempt does not exist (it may have been deleted).' : attempt.error.message}
        </div>
      </div>
    );
  }

  if (!attempt.data) {
    return (
      <div className="page">
        {back}
        <div className="status-note">Loading…</div>
      </div>
    );
  }

  const a = attempt.data;
  return (
    <div className="page detail-page">
      {back}

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">
            {a.score} / {a.total}
          </span>
          <span className="pill">{formatPercent(a.accuracy)} correct</span>
        </div>
        <div className="detail-actions">
          <Link to={`/quiz/${a.quiz_id}`} className="btn">
            Retake this quiz
          </Link>
        </div>
      </div>

      <div className="attempt-meta">
        {a.course_name} · {a.section_name} · {formatDate(a.submitted_at, { time: true })} · {formatDuration(a.time_spent_seconds)}
      </div>

      <div className="block">
        <div className="block-label">Questions</div>
        <div className="row-list">
          {a.questions.map((q) => (
            <QuestionReview
              key={q.question_id}
              number={q.position}
              type={q.type}
              stem={q.stem}
              options={q.options}
              selectedIndex={q.selected_index}
              answerIndex={q.answer_index}
              explanation={q.explanation}
              anchorSection={q.anchor_section}
              sourceExcerpt={q.source_excerpt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
