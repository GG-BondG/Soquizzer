import { render, screen } from '@testing-library/react';
import PowerRadar from './PowerRadar.jsx';

function attempt(id, day, score) {
  return {
    attempt_id: id,
    section_id: 's1',
    submitted_at: new Date(2026, 8, day, 10).toISOString(),
    score,
    total: 20,
    time_spent_seconds: 600,
  };
}

const idle = { error: null, loading: false, reload: () => {} };

describe('PowerRadar', () => {
  it('invites the student to finish a quiz when there is no history', () => {
    render(<PowerRadar history={{ ...idle, data: { attempts: [] } }} />);
    expect(screen.getByText(/first line will appear/i)).toBeTruthy();
    expect(document.querySelector('.power-latest')).toBeNull();
  });

  it('draws one orange line for a first quiz and no change badge', () => {
    render(<PowerRadar history={{ ...idle, data: { attempts: [attempt('a1', 10, 15)] } }} />);
    expect(document.querySelectorAll('.power-latest')).toHaveLength(1);
    expect(document.querySelectorAll('.power-trail')).toHaveLength(0);
    expect(screen.queryByText(/since last quiz/i)).toBeNull();
  });

  it('adds a new orange line after another quiz and keeps the old one as a fainter line', () => {
    const attempts = [attempt('a2', 11, 19), attempt('a1', 10, 10)]; // newest first, as the API sends them
    render(<PowerRadar history={{ ...idle, data: { attempts } }} />);
    expect(document.querySelectorAll('.power-latest')).toHaveLength(1);
    expect(document.querySelectorAll('.power-trail')).toHaveLength(1);
    expect(screen.getByText(/\+\d+ since last quiz/i)).toBeTruthy();
    // accuracy is (10 + 19) / 40 over the recent quizzes, not just the latest one
    expect(screen.getByRole('img', { name: /^Power \d+\. Accuracy 73/ })).toBeTruthy();
  });

  it('offers a retry when the history could not be loaded', () => {
    render(<PowerRadar history={{ data: null, error: new Error('boom'), loading: false, reload: () => {} }} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
});
