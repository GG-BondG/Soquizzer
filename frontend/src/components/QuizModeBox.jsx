import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { QUIZ_MODES } from '../quizModes.js';
import { useAssistant } from '../assistant/AssistantProvider.jsx';
import { ChevronIcon, ClipboardIcon, CloseIcon, LightbulbIcon } from './Icons.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import './QuizModeBox.css';

// A large box on the course page. Clicking it grows into a floating window listing the course's sections;
// picking one asks the backend for a quiz and opens the quiz page. A quiz is written from its section's PDF, so
// sections without one are marked and can't be picked.
export default function QuizModeBox({ mode, sections }) {
  const config = QUIZ_MODES[mode];
  const Icon = mode === 'trivia' ? LightbulbIcon : ClipboardIcon;
  const navigate = useNavigate();
  const assistant = useAssistant();
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [startingId, setStartingId] = useState(null); // section being generated for
  const [error, setError] = useState(null); // { status, message }
  const [pdfCounts, setPdfCounts] = useState({}); // section id -> number of PDFs (missing while still loading)

  const busy = startingId !== null;
  const list = sections ?? [];
  const missingCount = list.filter((s) => pdfCounts[s.id] === 0).length;

  // When the window opens, find out which sections have a PDF.
  useEffect(() => {
    if (!open || !sections || sections.length === 0) return undefined;
    let cancelled = false;
    Promise.all(
      sections.map((s) =>
        api.materials
          .list(s.id)
          .then((materials) => [s.id, materials.length])
          .catch(() => [s.id, undefined]) // unknown: leave it selectable and let the backend decide
      )
    ).then((pairs) => {
      if (!cancelled) setPdfCounts(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [open, sections]);

  function close() {
    if (!busy) setOpen(false);
  }

  async function start(section) {
    setStartingId(section.id);
    setError(null);
    assistant.loading('Writing 20 questions for you… hang tight!');
    try {
      const quiz = await api.quizzes.create(section.id, { type: config.apiType });
      assistant.success('Your quiz is ready. Good luck!');
      // the response already holds the questions, so hand them over instead of refetching
      navigate(`/quiz/${quiz.id}`, { state: { quiz, mode } });
    } catch (err) {
      setError({ status: err.status, message: err.message });
      assistant.error(err.status === 409 ? 'That section needs a PDF first.' : 'That did not work.');
      setStartingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        ref={boxRef}
        className={`quiz-box quiz-box-${mode}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <span className="quiz-box-top">
          <span className={`quiz-icon quiz-icon-${mode}`}>
            <Icon />
          </span>
          <span className={`quiz-tag quiz-tag-${mode}`}>{config.tag}</span>
        </span>
        <span>
          <span className="quiz-name">{config.label}</span>
          <span className="quiz-desc">{config.desc}</span>
        </span>
        <span className="quiz-hint">{sections ? `${list.length} section${list.length === 1 ? '' : 's'}` : ''}</span>
      </button>

      <FloatingWindow
        originRef={boxRef}
        originRadius={14}
        open={open}
        onClose={close}
        collapsed={
          <span className={`quiz-collapsed quiz-collapsed-${mode}`}>
            <Icon />
            {config.label}
          </span>
        }
      >
        <div className={`form-inner quiz-window quiz-window-${mode}`}>
          <div className="form-header">
            <div className="form-title">{config.label}</div>
            <button type="button" className="btn" onClick={close} disabled={busy}>
              <CloseIcon />
              Cancel
            </button>
          </div>
          <div className="pick-sub">Choose a section to start.</div>

          {missingCount > 0 && (
            <div className="info-note">
              {missingCount === list.length
                ? 'None of the sections has a PDF yet.'
                : 'Sections marked “No PDF yet” have no PDF.'}{' '}
              A quiz is written from a section’s PDF, so open the section and upload one first.
            </div>
          )}
          {error?.status === 409 && (
            <div className="info-note">This section has no PDF yet. Open the section, upload one, then try again.</div>
          )}
          {error && error.status !== 409 && (
            <div className="error-note">
              {error.status === 502 ? 'Generating the quiz failed. Nothing was saved, so it is safe to try again.' : error.message}
            </div>
          )}

          {sections === null && <div className="status-note">Loading sections…</div>}
          {sections && list.length === 0 && (
            <div className="empty-note">This course has no sections yet. Close this, add one below, then come back.</div>
          )}

          {list.length > 0 && (
            <div className="pick-list">
              {list.map((s, i) => {
                const missing = pdfCounts[s.id] === 0;
                return (
                  <button key={s.id} type="button" className="pick-row" onClick={() => start(s)} disabled={busy || missing}>
                    <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="row-title">{s.name}</span>
                    {startingId === s.id ? (
                      <span className="pick-status">Generating… this can take up to a minute</span>
                    ) : missing ? (
                      <span className="pick-note">No PDF yet</span>
                    ) : (
                      <ChevronIcon stroke="var(--text-3)" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </FloatingWindow>
    </>
  );
}
