import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../api.js';
import QuizPage from './QuizPage.jsx';

const quiz = {
  id: 'quiz1',
  section_id: 's1',
  created_at: '2026-09-19T00:00:00Z',
  questions: [
    { id: 'q1', position: 1, type: 'MULTIPLE_CHOICE', stem: 'What makes ATP?', options: ['Ribosomes', 'Mitochondria', 'Nucleus', 'Golgi'] },
    { id: 'q2', position: 2, type: 'TRUE_FALSE', stem: 'The nucleus stores DNA.', options: ['True', 'False'] },
  ],
};

const REVEAL_Q1 = {
  question_id: 'q1',
  answer_index: 1,
  explanation: 'Mitochondria produce ATP.',
  anchor_section: '2.3 Organelles',
  source_excerpt: 'Mitochondria make most of the cell’s ATP.',
};

function renderQuiz(mode) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/quiz/quiz1', state: { quiz, mode } }]}>
      <Routes>
        <Route path="/quiz/:quizId" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('QuizPage in Trivia', () => {
  it('shows the correct answer and explanation the moment an option is picked', async () => {
    const answer = vi.spyOn(api.quizzes, 'answer').mockResolvedValue(REVEAL_Q1);
    renderQuiz('trivia');

    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));

    expect(answer).toHaveBeenCalledWith('quiz1', 'q1');
    const feedback = await screen.findByRole('status');
    expect(feedback.textContent).toContain('Not quite. The correct answer is “Mitochondria”.');
    expect(feedback.textContent).toContain('Mitochondria produce ATP.');
    expect(feedback.textContent).toContain('2.3 Organelles');
    expect(screen.getByRole('radio', { name: /^Mitochondria/ }).className).toContain('is-right');
    expect(screen.getByRole('radio', { name: /^Ribosomes/ }).className).toContain('is-wrong');
  });

  it('says so when the pick was right', async () => {
    vi.spyOn(api.quizzes, 'answer').mockResolvedValue(REVEAL_Q1);
    renderQuiz('trivia');

    await userEvent.click(screen.getByRole('radio', { name: 'Mitochondria' }));

    expect((await screen.findByRole('status')).textContent).toContain('Correct!');
  });

  it('locks the question once answered: the first pick counts', async () => {
    const answer = vi.spyOn(api.quizzes, 'answer').mockResolvedValue(REVEAL_Q1);
    renderQuiz('trivia');

    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('radio', { name: /^Mitochondria/ }));

    expect(answer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: /^Ribosomes/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /^Mitochondria/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('takes the pick back and offers a retry when the answer cannot be fetched', async () => {
    const answer = vi.spyOn(api.quizzes, 'answer').mockRejectedValueOnce(new Error('Server is down.')).mockResolvedValue(REVEAL_Q1);
    renderQuiz('trivia');

    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));

    await waitFor(() => expect(screen.getByText(/Couldn’t show the answer: Server is down\./)).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Ribosomes' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('0 of 2 answered', { selector: '.exam-answered' })).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));
    expect((await screen.findByRole('status')).textContent).toContain('Not quite');
    expect(answer).toHaveBeenCalledTimes(2);
  });

  it('does not carry one question’s answer over to the next', async () => {
    vi.spyOn(api.quizzes, 'answer').mockResolvedValue(REVEAL_Q1);
    renderQuiz('trivia');

    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('QuizPage in Mock Test', () => {
  it('keeps the answers back until the quiz is submitted', async () => {
    const answer = vi.spyOn(api.quizzes, 'answer').mockResolvedValue(REVEAL_Q1);
    renderQuiz('mock');

    await userEvent.click(screen.getByRole('radio', { name: 'Ribosomes' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Nucleus' })); // free to change its mind

    expect(answer).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Nucleus' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Ribosomes' }).getAttribute('aria-checked')).toBe('false');
  });
});
