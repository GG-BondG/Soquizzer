import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BackIcon, ClockIcon, FlagIcon } from './Icons.jsx';
import './QuizMockExam.css';

// Stand-in for a question the backend's mock-exam generator would return.
const question = {
  prompt: 'Evaluate the limit:',
  expression: 'lim x→2  (x² − 4) / (x − 2)',
  choices: ['2', '4', 'Undefined', '0'],
  index: 6,
  total: 20,
  timeRemaining: '18:42',
};

export default function QuizMockExam() {
  const { code } = useParams();
  const [selected, setSelected] = useState(null);
  const [flagged, setFlagged] = useState(false);

  const progressPct = Math.round((question.index / question.total) * 100);

  return (
    <div className="page exam-page">
      <div className="exam-header">
        <Link to={`/course/${code}`} className="back-link">
          <BackIcon /> {code}
        </Link>
        <span className="exam-tag">Mock Exam · Timed &amp; Graded</span>
        <div className="exam-timer">
          <ClockIcon />
          {question.timeRemaining}
        </div>
      </div>

      <div className="exam-progress-row">
        <div className="exam-progress-text">
          Question {question.index} of {question.total}
        </div>
        <div className="exam-progress-track">
          <div className="exam-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="exam-panel">
        <div className="exam-question-row">
          <div className="exam-question">
            {question.prompt}
            <br />
            <span className="exam-expression">{question.expression}</span>
          </div>
          <button
            className={`flag-btn ${flagged ? 'is-flagged' : ''}`}
            onClick={() => setFlagged((f) => !f)}
          >
            <FlagIcon fill={flagged ? 'currentColor' : 'none'} />
            Flag
          </button>
        </div>

        <div className="option-list">
          {question.choices.map((text, i) => {
            const picked = selected === i;
            return (
              <div
                key={i}
                className={`option-row ${picked ? 'is-picked' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className={`radio ${picked ? 'is-picked' : ''}`} />
                <span className="option-text">{text}</span>
              </div>
            );
          })}
        </div>

        <div className="exam-nav">
          <button className="btn">← Previous</button>
          <button className="btn btn-exam">Next →</button>
        </div>
      </div>
    </div>
  );
}
