import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatClock, formatDuration, formatPercent, typeLabel } from '../format.js';
import { QUIZ_MODES } from '../quizModes.js';
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

  // Trivia or Mock Test, set by the box the student started from (colors and the label in the header).
  const mode = location.state?.mode in QUIZ_MODES ? location.state.mode : null;
  const themeClass = mode ? `quiz-${mode}` : '';
  const modeLabel = mode ? QUIZ_MODES[mode].label : 'Quiz';
  // Trivia is a warm-up: each answer is shown as soon as it is picked. Mock Test keeps them back until submitting.
  const isTrivia = mode === 'trivia';

  const [answers, setAnswers] = useState({}); // question id -> selected option index
  const [revealed, setRevealed] = useState({}); // Trivia: question id -> { answer_index, explanation, anchor_section, source_excerpt }
  const [revealing, setRevealing] = useState({}); // Trivia: question ids whose answer is being fetched
  const [revealError, setRevealError] = useState(null); // { questionId, message } when an answer could not be fetched
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
    // Restart only for a different quiz or after grading/retaking, not whenever the quiz object is re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (ratio >= 0.6) {
        pet.answerResult(true, `Nice! ${graded.score} out of ${graded.total} correct.`);
      } else {
        pet.answerResult(false, `${graded.score} out of ${graded.total}. Almost there — check the explanations and try again!`);
      }
    } catch (err) {
      setSubmitError(err.message);
      pet.error('I could not submit that.');
    } finally {
      setSubmitting(false);
    }
  }

  function pick(question, optionIndex) {
    if (!isTrivia) {
      setAnswers((a) => ({ ...a, [question.id]: optionIndex }));
      return;
    }
    if (revealed[question.id] || revealing[question.id]) return; // Trivia: the first pick counts, the answer is already in
    setAnswers((a) => ({ ...a, [question.id]: optionIndex }));
    setRevealing((r) => ({ ...r, [question.id]: true }));
    setRevealError(null);
    api.quizzes
      .answer(quiz.id, question.id)
      .then((answer) => setRevealed((r) => ({ ...r, [question.id]: answer })))
      .catch((err) => {
        // The answer never showed, so take the pick back and let the student choose again.
        setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([id]) => id !== question.id)));
        setRevealError({ questionId: question.id, message: err.message });
      })
      .finally(() => setRevealing((r) => Object.fromEntries(Object.entries(r).filter(([id]) => id !== question.id))));
  }

  function retake() {
    setAnswers({});
    setRevealed({});
    setRevealError(null);
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
      <div className={`page exam-page ${themeClass}`}>
        <div className="exam-header">
          <Link to={backTo} className="back-link">
            <BackIcon /> Section
          </Link>
          <span className="exam-tag">{modeLabel} · Results</span>
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
                anchorSection={r?.anchor_section}
                sourceExcerpt={r?.source_excerpt}
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
  const answer = revealed[question.id]; // set once Trivia has shown this question's answer
  const locked = isTrivia && (!!answer || !!revealing[question.id]);
  const gotItRight = answer && answers[question.id] === answer.answer_index;

  return (
    <div className={`page exam-page ${themeClass}`}>
      <div className="exam-header">
        <Link to={backTo} className="back-link">
          <BackIcon /> Section
        </Link>
        <span className="exam-tag">{modeLabel}</span>

        {/* top-right corner; the header is pinned, so progress and time stay in view while answering */}
        <aside className="quiz-status" aria-label="Quiz status">
          <div className="status-item">
            <span className="status-label">Progress</span>
            <span className="status-value">
              {index + 1} / {total}
            </span>
            <span className="status-bar">
              <span className="status-bar-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Answered</span>
            <span className="status-value">
              {answeredCount} / {total}
            </span>
          </div>
          <div className="status-time" aria-label="Time elapsed">
            <ClockIcon />
            {formatClock(elapsed)}
          </div>
        </aside>
      </div>

      <div className="exam-panel">
        <div className="quiz-type">
          Question {index + 1} · {typeLabel(question.type)}
        </div>
        <div className="exam-question">{question.stem}</div>

        <div className="option-list">
          {question.options.map((text, i) => {
            const picked = answers[question.id] === i;
            const isRight = answer?.answer_index === i;
            const state = isRight ? 'is-right' : answer && picked ? 'is-wrong' : picked ? 'is-picked' : '';
            return (
              <div
                key={i}
                role="radio"
                aria-checked={picked}
                aria-disabled={locked}
                tabIndex={0}
                className={`option-row ${state} ${locked ? 'is-locked' : ''}`}
                onClick={() => pick(question, i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(question, i);
                  }
                }}
              >
                <span className={`radio ${picked ? 'is-picked' : ''}`} />
                <span className="option-text">{text}</span>
                {answer && (isRight || picked) && (
                  <span className="option-tag">{isRight && picked ? 'Your answer · correct' : isRight ? 'Correct answer' : 'Your answer'}</span>
                )}
              </div>
            );
          })}
        </div>

        {answer && (
          <div className={`reveal ${gotItRight ? 'is-right' : 'is-wrong'}`} role="status">
            <div className="reveal-title">
              {gotItRight ? 'Correct!' : `Not quite. The correct answer is “${question.options[answer.answer_index]}”.`}
            </div>
            {answer.explanation && <div className="reveal-explain">{answer.explanation}</div>}
            {(answer.anchor_section || answer.source_excerpt) && (
              <div className="reveal-source">
                <span className="reveal-source-label">
                  From the material{answer.anchor_section ? ` · ${answer.anchor_section}` : ''}
                </span>
                {answer.source_excerpt && <span className="reveal-source-text">{answer.source_excerpt}</span>}
              </div>
            )}
          </div>
        )}
        {revealError?.questionId === question.id && (
          <div className="error-note">Couldn’t show the answer: {revealError.message} Pick again to retry.</div>
        )}

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
