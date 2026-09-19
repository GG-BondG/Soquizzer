import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizPage from './QuizPage.jsx';

const assistant = vi.hoisted(() => ({
  answerResult: vi.fn(),
  loading: vi.fn(),
  error: vi.fn(),
  idle: vi.fn(),
}));

const submit = vi.hoisted(() => vi.fn());

vi.mock('../pet/PetProvider.jsx', () => ({ useAssistant: () => assistant }));
vi.mock('../api.js', () => ({
  api: {
    quizzes: {
      submit,
      get: vi.fn(),
    },
  },
  subjectLabel: (value) => value,
}));

const quiz = {
  id: 'quiz-1',
  section_id: 'sec-1',
  questions: [
    { id: 'q1', position: 1, type: 'MULTIPLE_CHOICE', stem: 'What makes ATP?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'] },
  ],
};

function renderQuiz() {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/quiz/quiz-1', state: { quiz } }]}>
      <Routes>
        <Route path="/quiz/:quizId" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('QuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the answer and calls assistant.answerResult for a correct result', async () => {
    submit.mockResolvedValue({
      attempt_id: 'attempt-1',
      score: 1,
      total: 1,
      timeSpentSeconds: 12,
      results: [{ question_id: 'q1', selected_index: 1, answer_index: 1, explanation: 'Mitochondria make ATP.', anchor_section: '', source_excerpt: '' }],
    });

    renderQuiz();
    fireEvent.click(screen.getByText('Mitochondria'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(assistant.loading).toHaveBeenCalledWith('Checking your answers…');
    await screen.findByText('Results');
    expect(assistant.answerResult).toHaveBeenCalledWith(true, expect.stringContaining('1 out of 1'));
  });

  it('shows the wrong-answer bubble and reports submit errors', async () => {
    submit.mockRejectedValue(new Error('Network down'));

    renderQuiz();
    fireEvent.click(screen.getByText('Nucleus'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(assistant.error).toHaveBeenCalledWith('I could not submit that.');
  });

  it('calls assistant.idle when retaking the quiz', async () => {
    submit.mockResolvedValue({
      attempt_id: 'attempt-1',
      score: 0,
      total: 1,
      results: [{ question_id: 'q1', selected_index: 0, answer_index: 1, explanation: 'Mitochondria make ATP.', anchor_section: '', source_excerpt: '' }],
    });

    renderQuiz();
    fireEvent.click(screen.getByText('Nucleus'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText('Results');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(assistant.idle).toHaveBeenCalled();
  });
});
