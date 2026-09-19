import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPage from './QuizPage.jsx';

const assistant = vi.hoisted(() => ({
  answerResult: vi.fn(),
  loading: vi.fn(),
  error: vi.fn(),
  idle: vi.fn(),
  askAbout: vi.fn(),
  stopAsking: vi.fn(),
}));
const check = vi.hoisted(() => vi.fn());

vi.mock('../pet/PetProvider.jsx', () => ({ useAssistant: () => assistant }));
vi.mock('../api.js', () => ({ api: { quizzes: { check, get: vi.fn(), submit: vi.fn() } } }));

const quiz = {
  id: 'quiz-1',
  section_id: 'sec-1',
  questions: [
    { id: 'q1', position: 1, type: 'MULTIPLE_CHOICE', stem: 'What makes ATP?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'] },
    { id: 'q2', position: 2, type: 'TRUE_FALSE', stem: 'The nucleus stores DNA.', options: ['True', 'False'] },
  ],
};

function graded(selected, answer, explanation = 'Mitochondria make ATP.') {
  return {
    question_id: 'q1',
    selected_index: selected,
    is_correct: selected === answer,
    answer_index: answer,
    explanation,
    anchor_section: '',
    source_excerpt: '',
  };
}

function renderQuiz(mode) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/quiz/quiz-1', state: { quiz, mode } }]}>
      <Routes>
        <Route path="/quiz/:quizId" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('QuizPage in Trivia', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grades a pick at once, shows the answer, and the pet cheers right away', async () => {
    check.mockResolvedValue(graded(1, 1));
    renderQuiz('trivia');

    fireEvent.click(screen.getByText('Mitochondria'));

    expect(check).toHaveBeenCalledWith('quiz-1', 'q1', 1);
    expect(await screen.findByText('Mitochondria make ATP.')).toBeTruthy();
    expect(screen.getByText('Correct')).toBeTruthy();
    // no text argument: the pet picks one of its own voiced lines
    expect(assistant.answerResult).toHaveBeenCalledWith(true, undefined);
  });

  it('shows the right option and consoles the student after a wrong pick', async () => {
    check.mockResolvedValue(graded(0, 1));
    renderQuiz('trivia');

    fireEvent.click(screen.getByText('Nucleus'));

    expect(await screen.findByText('Incorrect')).toBeTruthy();
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(assistant.answerResult).toHaveBeenCalledWith(false, expect.stringMatching(/not quite/i));
  });

  it('makes the pick final: the answer stays on screen and is not graded twice', async () => {
    check.mockResolvedValue(graded(0, 1));
    renderQuiz('trivia');

    fireEvent.click(screen.getByText('Nucleus'));
    await screen.findByText('Incorrect');
    fireEvent.click(screen.getByText('Next →'));
    fireEvent.click(screen.getByText('← Previous'));

    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('lets the student pick again when the answer could not be fetched', async () => {
    check.mockRejectedValue(new Error('Network down'));
    renderQuiz('trivia');

    fireEvent.click(screen.getByText('Mitochondria'));

    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(assistant.error).toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true));
  });
});

describe('QuizPage in Mock Test', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the answers secret until the quiz is submitted', () => {
    renderQuiz('mock');

    fireEvent.click(screen.getByText('Mitochondria'));

    expect(check).not.toHaveBeenCalled();
    expect(assistant.answerResult).not.toHaveBeenCalled();
    expect(screen.getAllByRole('radio')[1].getAttribute('aria-checked')).toBe('true');
  });
});
