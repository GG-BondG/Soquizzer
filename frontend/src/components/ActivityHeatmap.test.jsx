import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityHeatmap from './ActivityHeatmap.jsx';

const idle = { error: null, loading: false, reload: () => {} };

function attempt(id, daysAgo, score) {
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  when.setHours(9, 0, 0, 0);
  return {
    attempt_id: id,
    course_name: 'Biology 101',
    section_name: `Chapter ${id}`,
    submitted_at: when.toISOString(),
    score,
    total: 20,
  };
}

function renderWith(attempts) {
  return render(
    <MemoryRouter>
      <ActivityHeatmap history={{ ...idle, data: { attempts } }} />
    </MemoryRouter>
  );
}

describe('ActivityHeatmap', () => {
  it('says so when there are no quizzes yet, and still offers the breathing box', () => {
    renderWith([]);
    expect(screen.getByText(/first quiz will show up here/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start breathing exercise/i })).toBeTruthy();
  });

  it('lists the three newest quizzes, each linking to its attempt', () => {
    renderWith([attempt('1', 0, 18), attempt('2', 1, 10), attempt('3', 2, 12), attempt('4', 9, 5)]);
    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute('href')).toBe('/attempts/1');
    expect(screen.getByText('18/20')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('shows the streak, the week and the best score', () => {
    renderWith([attempt('1', 0, 18), attempt('2', 1, 10)]);
    expect(screen.getByText('Day streak').previousSibling.textContent).toBe('2');
    expect(screen.getByText('This week').previousSibling.textContent).toBe('2');
    expect(screen.getByText('Best score').previousSibling.textContent).toBe('90%');
  });
});
