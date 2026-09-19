import { typeLabel } from '../format.js';
import './QuestionReview.css';

// One graded question: every option, the user's pick, the correct answer and the
// explanation. Used by the quiz results and the history detail page.
// `selectedIndex` is null/undefined when the question was left unanswered.
export default function QuestionReview({ number, type, stem, options, selectedIndex, answerIndex, explanation }) {
  const answered = selectedIndex !== null && selectedIndex !== undefined;
  const correct = answered && selectedIndex === answerIndex;
  const status = !answered ? 'skipped' : correct ? 'correct' : 'wrong';

  return (
    <div className="review">
      <div className="review-head">
        <span className="review-num">{String(number).padStart(2, '0')}</span>
        <span className={`review-status review-status-${status}`}>
          {status === 'skipped' ? 'Not answered' : correct ? 'Correct' : 'Incorrect'}
        </span>
        {type && <span className="review-type">{typeLabel(type)}</span>}
      </div>

      <div className="review-stem">{stem}</div>

      <div className="review-options">
        {options.map((text, i) => {
          const isAnswer = i === answerIndex;
          const isPicked = i === selectedIndex;
          return (
            <div key={i} className={`review-option ${isAnswer ? 'is-right' : isPicked ? 'is-wrong' : ''}`}>
              <span className="review-option-text">{text}</span>
              {(isAnswer || isPicked) && (
                <span className="review-tag">
                  {isAnswer && isPicked ? 'Your answer · correct' : isAnswer ? 'Correct answer' : 'Your answer'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {explanation && <div className="review-explain">{explanation}</div>}
    </div>
  );
}
