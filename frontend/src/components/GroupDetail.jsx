import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetContext.jsx';
import { BackIcon, ChevronIcon } from './Icons.jsx';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const pet = usePet();

  const group = useApi(() => api.groups.get(groupId), [groupId]);
  const course = useApi(() => (group.data ? api.courses.get(group.data.course_id) : null), [group.data?.course_id]);
  const quizzes = useApi(() => api.quizzes.list(groupId), [groupId]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null); // { status, message }

  async function newQuiz() {
    setCreating(true);
    setCreateError(null);
    pet.loading('Writing 20 questions for you… hang tight!');
    try {
      const quiz = await api.quizzes.create(groupId);
      pet.success('Your quiz is ready. Good luck!');
      // the response already holds the questions, so hand them over instead of refetching
      navigate(`/quiz/${quiz.id}`, { state: { quiz } });
    } catch (err) {
      setCreateError({ status: err.status, message: err.message });
      pet.error(err.status === 409 ? 'I need some material first.' : 'That did not work.');
      setCreating(false);
    }
  }

  if (group.error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="error-note">
          {group.error.status === 404 ? 'This section does not exist (it may have been deleted).' : group.error.message}
        </div>
      </div>
    );
  }

  if (!group.data) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="status-note">Loading…</div>
      </div>
    );
  }

  const g = group.data;
  const list = quizzes.data ?? [];

  return (
    <div className="page detail-page">
      <Link to={`/course/${g.course_id}`} className="back-link">
        <BackIcon /> {course.data?.name ?? 'Course'}
      </Link>

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">{g.name}</span>
        </div>
        <div className="detail-actions">
          <button type="button" className="btn btn-primary" onClick={newQuiz} disabled={creating}>
            {creating ? 'Generating…' : 'New quiz'}
          </button>
        </div>
      </div>

      {creating && <div className="status-note">Generating a quiz from your course material. This can take up to a minute.</div>}

      {createError?.status === 409 && (
        <div className="info-note">
          This course has no material yet. <Link to={`/course/${g.course_id}`}>Upload a PDF first</Link>, then come back to
          create a quiz.
        </div>
      )}
      {createError && createError.status !== 409 && (
        <div className="error-note">
          {createError.status === 502
            ? 'Generating the quiz failed. Nothing was saved, so it is safe to try again.'
            : createError.message}
          <div>
            <button type="button" className="btn btn-small" onClick={newQuiz} disabled={creating}>
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="block">
        <div className="block-header">
          <div className="block-label">Quizzes</div>
          {quizzes.data && <div className="block-count">{list.length} total</div>}
        </div>

        {quizzes.error && (
          <div className="error-note">
            {quizzes.error.message}
            <div>
              <button type="button" className="btn btn-small" onClick={quizzes.reload}>
                Try again
              </button>
            </div>
          </div>
        )}

        {list.length > 0 && (
          <div className="row-list">
            {list.map((q, i) => (
              <div className="row" key={q.id}>
                {/* the list is newest first, so number from the bottom */}
                <Link to={`/quiz/${q.id}`} className="row-link">
                  <span className="row-index">{String(list.length - i).padStart(2, '0')}</span>
                  <span className="row-title">Quiz {list.length - i}</span>
                  <span className="row-meta">
                    {q.question_count} questions · {q.attempt_count} attempt{q.attempt_count === 1 ? '' : 's'}
                  </span>
                  <span className="row-meta">{formatDate(q.created_at, { time: true })}</span>
                  <ChevronIcon stroke="var(--text-3)" />
                </Link>
              </div>
            ))}
          </div>
        )}
        {quizzes.data && list.length === 0 && <div className="empty-note">No quizzes yet. Press “New quiz” to generate the first one.</div>}
      </div>
    </div>
  );
}
