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

const OPTION_MOTIONS = ['motion-pop', 'motion-ripple', 'motion-tilt'];
const RESULT_MOTIONS = ['result-motion-rise', 'result-motion-bloom', 'result-motion-swing'];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

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
  // Trivia reveals the answer after every question, and the pet reacts to it (in voice) at once.
  const instant = mode === 'trivia';

  const [answers, setAnswers] = useState({}); // question id -> selected option index
  const [revealed, setRevealed] = useState({}); // Trivia: question id -> the graded answer from the backend
  const checking = useRef(new Set()); // Trivia: questions whose answer is being fetched
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [optionMotion, setOptionMotion] = useState(null);
  const [resultMotion, setResultMotion] = useState(RESULT_MOTIONS[0]);
  const startedAt = useRef(null);
  const optionMotionTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(optionMotionTimer.current), []);

  // Count up the score when results arrive. Reduced-motion users see the final value immediately.
  useEffect(() => {
    if (!result) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || result.score === 0) {
      setDisplayedScore(result.score);
      return;
    }

    let frame;
    const started = performance.now();
    const duration = 650;
    const tick = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      setDisplayedScore(Math.round(result.score * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result]);

  function chooseAnswer(questionId, optionIndex) {
    clearTimeout(optionMotionTimer.current);
    setOptionMotion({ questionId, optionIndex, name: randomItem(OPTION_MOTIONS) });
    setAnswers((current) => ({ ...current, [questionId]: optionIndex }));
    optionMotionTimer.current = setTimeout(() => setOptionMotion(null), 450);
  }

  // Lets the pet answer questions about whichever question is on screen; stops once graded or on leaving the page.
  useEffect(() => {
    const current = quiz?.questions?.[index];
    if (!current || result) {
      pet.stopAsking();
      return undefined;
    }
    pet.askAbout(quiz.id, current.id);
    return () => pet.stopAsking();
  }, [quiz, index, result, pet]);

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
      setDisplayedScore(0);
      setResultMotion(randomItem(RESULT_MOTIONS));
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

  // Picking an option. In Trivia the pick is final: it is graded right away, the answer and explanation replace
  // the options, and the pet cheers (with its voice clip) or consoles the student.
  function pick(question, i) {
    if (!instant) {
      chooseAnswer(question.id, i);
      return;
    }
    if (revealed[question.id] || checking.current.has(question.id)) return;

    checking.current.add(question.id);
    chooseAnswer(question.id, i);
    setSubmitError('');
    api.quizzes
      .check(quiz.id, question.id, i)
      .then((graded) => {
        setRevealed((r) => ({ ...r, [question.id]: graded }));
        pet.answerResult(graded.is_correct, graded.is_correct ? undefined : 'Not quite — read the explanation, then on to the next one!');
      })
      .catch((err) => {
        setAnswers((a) => {
          const rest = { ...a };
          delete rest[question.id];
          return rest;
        });
        setSubmitError(err.message);
        pet.error('I could not check that one.');
      })
      .finally(() => checking.current.delete(question.id));
  }

  function retake() {
    setAnswers({});
    setRevealed({});
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
    const scoreRatio = result.total ? result.score / result.total : 0;
    return (
      <div className={`page exam-page ${themeClass}`}>
        <div className="exam-header">
          <Link to={backTo} className="back-link">
            <BackIcon /> Section
          </Link>
          <span className="exam-tag">{modeLabel} · Results</span>
          <span />
        </div>

        <div className={`result-card ${resultMotion}`}>
          {scoreRatio >= 0.8 && (
            <div className="result-confetti" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          )}
          <div className="result-score" aria-label={`${result.score} out of ${result.total}`}>
            <span aria-hidden="true">
              {displayedScore}
              <span className="result-total"> / {result.total}</span>
            </span>
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
          {quiz.questions.map((q, reviewIndex) => {
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
                animate
                revealIndex={reviewIndex}
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
        {question.id in revealed ? (
          <QuestionReview
            number={question.position}
            type={question.type}
            stem={question.stem}
            options={question.options}
            selectedIndex={revealed[question.id].selected_index}
            answerIndex={revealed[question.id].answer_index}
            explanation={revealed[question.id].explanation}
            anchorSection={revealed[question.id].anchor_section}
            sourceExcerpt={revealed[question.id].source_excerpt}
          />
        ) : (
          <>
            <div className="quiz-type">
              Question {index + 1} · {typeLabel(question.type)}
            </div>
            <div className="exam-question">{question.stem}</div>

            <div className="option-list">
              {question.options.map((text, i) => {
                const picked = answers[question.id] === i;
                const motion =
                  optionMotion?.questionId === question.id && optionMotion.optionIndex === i ? optionMotion.name : '';
                return (
                  <div
                    key={i}
                    role="radio"
                    aria-checked={picked}
                    tabIndex={0}
                    className={`option-row ${picked ? 'is-picked' : ''} ${motion}`}
                    onClick={() => pick(question, i)}
                    onAnimationEnd={(event) => {
                      if (event.target === event.currentTarget && motion) {
                        clearTimeout(optionMotionTimer.current);
                        setOptionMotion(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick(question, i);
                      }
                    }}
                  >
                    <span className={`radio ${picked ? 'is-picked' : ''}`} />
                    <span className="option-text">{text}</span>
                  </div>
                );
              })}
            </div>
          </>
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
