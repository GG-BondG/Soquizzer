import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatClock, formatDuration, formatPercent, typeLabel } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon, ClockIcon } from './Icons.jsx';
import QuestionReview from './QuestionReview.jsx';
import './QuizPage.css';

export default function QuizPage() {
  const { quizId } = useParams();
  const location = useLocation();
  const pet = usePet();

  // Coming from "New quiz" the questions arrive in router state; otherwise fetch them.
  const seeded = location.state?.quiz?.id === quizId ? location.state.quiz : null;
  const fetched = useApi(() => (seeded ? null : api.quizzes.get(quizId)), [quizId, !!seeded]);
  const quiz = seeded ?? fetched.data;

  const [answers, setAnswers] = useState({}); // question id -> selected option index
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const startedAt = useRef(null);

  // The clock starts when the questions are on screen and stops once graded.
  // (Retaking clears `result`, which restarts it.)
  useEffect(() => {
    if (!quiz || result) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [quiz?.id, result]);

  async function submit() {
    const timeSpentSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const payload = quiz.questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({ question_id: q.id, selected_index: answers[q.id] }));

    setSubmitting(true);
    setSubmitError('');
    pet.loading('Checking your answers…');
    try {
      const graded = await api.quizzes.submit(quiz.id, { answers: payload, timeSpentSeconds });
      setResult({ ...graded, timeSpentSeconds });
      const ratio = graded.total ? graded.score / graded.total : 0;
      if (ratio >= 0.6) pet.cheer();
      else pet.idle(`${graded.score} out of ${graded.total}. Check the explanations and try again!`);
    } catch (err) {
      setSubmitError(err.message);
      pet.error('I could not submit that.');
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setAnswers({});
    setIndex(0);
    setSubmitError('');
    setResult(null);
    pet.idle();
  }

  if (fetched.error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="error-note">
          {fetched.error.status === 404 ? 'This quiz does not exist (it may have been deleted).' : fetched.error.message}
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="status-note">Loading quiz…</div>
      </div>
    );
  }

  const backTo = `/section/${quiz.section_id}`;

  if (result) {
    const byQuestion = new Map(result.results.map((r) => [r.question_id, r]));
    return (
      <div className="page exam-page">
        <div className="exam-header">
          <Link to={backTo} className="back-link">
            <BackIcon /> Section
          </Link>
          <span className="exam-tag">Results</span>
          <span />
        </div>

        <div className="result-card">
          <div className="result-score">
            {result.score}
            <span className="result-total"> / {result.total}</span>
          </div>
          <div className="result-meta">
            {formatPercent(result.total ? result.score / result.total : null)} correct · {formatDuration(result.timeSpentSeconds)}
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-exam" onClick={retake}>
              Try again
            </button>
            <Link to={backTo} className="btn">
              Back to section
            </Link>
            <Link to={`/attempts/${result.attempt_id}`} className="btn">
              View in history
            </Link>
          </div>
        </div>

        <div className="result-review">
          {quiz.questions.map((q) => {
            const r = byQuestion.get(q.id);
            return (
              <QuestionReview
                key={q.id}
                number={q.position}
                type={q.type}
                stem={q.stem}
                options={q.options}
                selectedIndex={r?.selected_index}
                answerIndex={r?.answer_index}
                explanation={r?.explanation}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const total = quiz.questions.length;
  const question = quiz.questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index === total - 1;

  return (
    <div className="page exam-page">
      <div className="exam-header">
        <Link to={backTo} className="back-link">
          <BackIcon /> Section
        </Link>
        <span className="exam-tag">Quiz</span>
        <div className="exam-timer">
          <ClockIcon />
          {formatClock(elapsed)}
        </div>
      </div>

      <div className="exam-progress-row">
        <div className="exam-progress-text">
          Question {index + 1} of {total}
        </div>
        <div className="exam-progress-track">
          <div className="exam-progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="exam-panel">
        <div className="quiz-type">{typeLabel(question.type)}</div>
        <div className="exam-question">{question.stem}</div>

        <div className="option-list">
          {question.options.map((text, i) => {
            const picked = answers[question.id] === i;
            return (
              <div
                key={i}
                role="radio"
                aria-checked={picked}
                tabIndex={0}
                className={`option-row ${picked ? 'is-picked' : ''}`}
                onClick={() => setAnswers((a) => ({ ...a, [question.id]: i }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setAnswers((a) => ({ ...a, [question.id]: i }));
                  }
                }}
              >
                <span className={`radio ${picked ? 'is-picked' : ''}`} />
                <span className="option-text">{text}</span>
              </div>
            );
          })}
        </div>

        <div className="q-jump" aria-label="Jump to question">
          {quiz.questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              className={`q-dot ${i === index ? 'is-current' : ''} ${answers[q.id] !== undefined ? 'is-answered' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ' (answered)' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {submitError && <div className="error-note">{submitError}</div>}

        <div className="exam-nav">
          <button type="button" className="btn" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            ← Previous
          </button>
          <span className="exam-answered">
            {answeredCount} of {total} answered
          </span>
          {isLast ? (
            <button type="button" className="btn btn-exam" onClick={submit} disabled={submitting || answeredCount === 0}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          ) : (
            <button type="button" className="btn btn-exam" onClick={() => setIndex(index + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
