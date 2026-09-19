import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { api } from '../api.js';
import SectionDetail from './SectionDetail.jsx';

vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  api: {
    sections: { get: vi.fn() },
    courses: { get: vi.fn() },
    quizzes: { list: vi.fn(), create: vi.fn() },
    materials: { list: vi.fn() },
  },
}));
vi.mock('../pet/PetProvider.jsx', () => ({
  usePet: () => ({ loading: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

function QuizStub() {
  const { state } = useLocation();
  return <div>quiz page · {state.mode} · {state.quiz.id}</div>;
}

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/section/7']}>
      <Routes>
        <Route path="/section/:sectionId" element={<SectionDetail />} />
        <Route path="/quiz/:quizId" element={<QuizStub />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SectionDetail quiz buttons', () => {
  beforeEach(() => {
    api.sections.get.mockResolvedValue({ id: 7, name: 'Week 1', course_id: 3 });
    api.courses.get.mockResolvedValue({ id: 3, name: 'Biology' });
    api.quizzes.list.mockResolvedValue([]);
    api.materials.list.mockResolvedValue([{ id: 1, source_filename: 'week1.pdf', created_at: '2026-01-01T00:00:00Z' }]);
    api.quizzes.create.mockResolvedValue({ id: 42, questions: [] });
  });

  it('offers one button for Trivia and one for Mock Test', async () => {
    renderSection();

    expect(await screen.findByRole('button', { name: 'New Trivia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Mock Test' })).toBeTruthy();
  });

  it.each([
    ['New Trivia', 'TRIVIA', 'trivia'],
    ['New Mock Test', 'MOCK_TEST', 'mock'],
  ])('%s asks the backend for a %s quiz and opens it in that mode', async (name, apiType, mode) => {
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name }));

    await waitFor(() => expect(api.quizzes.create).toHaveBeenCalledWith('7', { type: apiType }));
    expect(await screen.findByText(`quiz page · ${mode} · 42`)).toBeTruthy();
  });

  it('disables both buttons while the section has no PDF', async () => {
    api.materials.list.mockResolvedValue([]);
    renderSection();

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Trivia' }).disabled).toBe(true));
    expect(screen.getByRole('button', { name: 'New Mock Test' }).disabled).toBe(true);
  });

  it('retries with the same kind of quiz after a failure', async () => {
    api.quizzes.create.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 502 }));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'New Mock Test' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(api.quizzes.create).toHaveBeenCalledTimes(2));
    expect(api.quizzes.create).toHaveBeenLastCalledWith('7', { type: 'MOCK_TEST' });
  });
});
