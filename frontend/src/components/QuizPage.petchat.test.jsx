import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PetProvider } from '../pet/PetProvider.jsx';
import QuizPage from './QuizPage.jsx';

const chatAsk = vi.hoisted(() => vi.fn());
// The pet renders every time PetProvider does, so counting its renders counts the provider's. A render loop
// fails the test with an error here instead of hanging it.
const petRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('../pet/Live2DPet.jsx', () => ({
  default: ({ onTap }) => {
    petRenders.count += 1;
    if (petRenders.count > 200) throw new Error('PetProvider is re-rendering in a loop');
    return (
      <button type="button" data-testid="pet-button" onClick={onTap}>
        pet
      </button>
    );
  },
}));
vi.mock('../api.js', () => ({ api: { chat: { ask: chatAsk }, quizzes: { check: vi.fn(), get: vi.fn(), submit: vi.fn() } } }));

const quiz = {
  id: 'quiz-1',
  section_id: 'sec-1',
  questions: [
    { id: 'q1', position: 1, type: 'MULTIPLE_CHOICE', stem: 'What makes ATP?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'] },
    { id: 'q2', position: 2, type: 'TRUE_FALSE', stem: 'The nucleus stores DNA.', options: ['True', 'False'] },
  ],
};

function renderQuiz() {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/quiz/quiz-1', state: { quiz, mode: 'mock' } }]}>
      <PetProvider>
        <Routes>
          <Route path="/quiz/:quizId" element={<QuizPage />} />
        </Routes>
      </PetProvider>
    </MemoryRouter>
  );
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

// The real QuizPage inside the real PetProvider: the unit tests of each use a stand-in for the other, so they
// cannot see a loop that only shows up when the two are wired together.
describe('QuizPage wired to the real pet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    petRenders.count = 0;
  });

  it('settles after mounting instead of re-rendering forever', async () => {
    renderQuiz();
    await settle();

    const settled = petRenders.count;
    await settle();

    expect(petRenders.count).toBe(settled);
  });

  it('does not loop while the student types in the chat box', async () => {
    renderQuiz();
    fireEvent.click(screen.getByTestId('pet-button'));
    await settle();

    fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: 'hi' } });
    await settle();
    const settled = petRenders.count;
    await settle();

    expect(petRenders.count).toBe(settled);
  });

  it('asks the tutor about the question that is on screen', async () => {
    chatAsk.mockResolvedValue({ reply: 'Think about what makes energy.' });
    renderQuiz();
    fireEvent.click(screen.getByTestId('pet-button'));
    fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: 'Help?' } });

    fireEvent.click(screen.getByText('Send'));

    expect(await screen.findByText('Think about what makes energy.')).toBeTruthy();
    expect(chatAsk).toHaveBeenCalledWith('quiz-1', 'q1', expect.objectContaining({ message: 'Help?' }));

    fireEvent.click(screen.getByText('Next →'));
    await waitFor(() => expect(screen.queryByText('Think about what makes energy.')).toBeNull());
  });
});
