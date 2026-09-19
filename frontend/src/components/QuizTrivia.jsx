import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon } from './Icons.jsx';
import './QuizTrivia.css';

// Stand-in for a question the backend's trivia generator would return.
const question = {
  fact: 'Fun fact — it took mathematicians over 150 years after Newton and Leibniz to pin down what a "limit" rigorously means.',
  prompt: 'Who gave calculus its first rigorous, epsilon-delta definition of a limit?',
  choices: [
    { key: 'A', text: 'Isaac Newton' },
    { key: 'B', text: 'Augustin-Louis Cauchy' },
    { key: 'C', text: 'Leonhard Euler' },
    { key: 'D', text: 'Blaise Pascal' },
  ],
  correct: 'B',
  explanation: {
    correct: 'Exactly — Cauchy formalized the limit with epsilon-delta in the 1820s.',
    incorrect: 'Not quite. It was Augustin-Louis Cauchy, in the 1820s.',
  },
  index: 2,
  total: 5,
};

export default function QuizTrivia() {
  const { code } = useParams();
  const [selected, setSelected] = useState(null);
  const { cheer } = usePet();

  const hasSelected = selected !== null;
  const isCorrect = selected === question.correct;

  return (
    <div className="page trivia-page">
      <div className="trivia-header">
        <Link to={`/course/${code}`} className="back-link">
          <BackIcon /> {code}
        </Link>
        <div className="trivia-header-right">
          <span className="trivia-tag">Warm-up Trivia</span>
          <span className="trivia-progress-text">
            Question {question.index} of {question.total}
          </span>
        </div>
      </div>

      <div className="progress-dots">
        {Array.from({ length: question.total }).map((_, i) => (
          <span
            key={i}
            className={
              'dot ' + (i + 1 < question.index ? 'dot-done' : i + 1 === question.index ? 'dot-current' : '')
            }
          />
        ))}
      </div>

      <div className="trivia-card">
        <div className="trivia-fact">{question.fact}</div>
        <div className="trivia-prompt">{question.prompt}</div>

        <div className="choice-list">
          {question.choices.map((choice) => {
            const picked = selected === choice.key;
            const correctness = picked ? (choice.key === question.correct ? 'correct' : 'incorrect') : '';
            return (
              <div
                key={choice.key}
                className={`choice ${correctness}`}
                onClick={() => {
                  if (choice.key === selected) return;
                  setSelected(choice.key);
                  if (choice.key === question.correct) cheer();
                }}
              >
                <span className={`choice-badge ${correctness}`}>{choice.key}</span>
                <span>{choice.text}</span>
              </div>
            );
          })}
        </div>

        {hasSelected && (
          <div className={`feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
            {isCorrect ? question.explanation.correct : question.explanation.incorrect}
          </div>
        )}

        <div className="trivia-actions">
          <button className="btn btn-trivia">Next question →</button>
        </div>
      </div>
    </div>
  );
}
