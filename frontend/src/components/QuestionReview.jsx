import { typeLabel } from '../format.js';
import MathText from './MathText.jsx';
import './QuestionReview.css';

// One graded question: every option, the user's pick, the correct answer and the
// explanation, and where in the material it came from (so a wrong answer says what to
// re-read). Used by the quiz results and the history detail page.
// `selectedIndex` is null/undefined when the question was left unanswered.
export default function QuestionReview({
  number,
  type,
  stem,
  options,
  selectedIndex,
  answerIndex,
  explanation,
  anchorSection,
  sourceExcerpt,
  animate = false,
  revealIndex = 0,
}) {
  const answered = selectedIndex !== null && selectedIndex !== undefined;
  const correct = answered && selectedIndex === answerIndex;
  const status = !answered ? 'skipped' : correct ? 'correct' : 'wrong';

  return (
    <div
      className={`review review-${status} ${animate ? 'is-animated' : ''}`}
      style={animate ? { '--review-delay': `${Math.min(revealIndex, 8) * 70}ms` } : undefined}
    >
      <div className="review-head">
        <span className="review-num">{String(number).padStart(2, '0')}</span>
        <span className={`review-status review-status-${status}`}>
          {status === 'skipped' ? 'Not answered' : correct ? 'Correct' : 'Incorrect'}
        </span>
        {type && <span className="review-type">{typeLabel(type)}</span>}
      </div>

      <div className="review-stem">
        <MathText text={stem} />
      </div>

      <div className="review-options">
        {options.map((text, i) => {
          const isAnswer = i === answerIndex;
          const isPicked = i === selectedIndex;
          return (
            <div key={i} className={`review-option ${isAnswer ? 'is-right' : isPicked ? 'is-wrong' : ''}`}>
              <span className="review-option-text">
                <MathText text={text} />
              </span>
              {(isAnswer || isPicked) && (
                <span className="review-tag">
                  {isAnswer && isPicked ? 'Your answer · correct' : isAnswer ? 'Correct answer' : 'Your answer'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {explanation && (
        <div className="review-explain">
          <MathText text={explanation} />
        </div>
      )}

      {(anchorSection || sourceExcerpt) && (
        <div className="review-source">
          <div className="review-source-label">
            {correct ? 'From the material' : 'Re-read this'}
            {anchorSection ? ` · ${anchorSection}` : ''}
          </div>
          {sourceExcerpt && (
            <div className="review-source-text">
              <MathText text={sourceExcerpt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
