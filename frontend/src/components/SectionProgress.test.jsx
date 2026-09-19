import { render, screen } from '@testing-library/react';
import SectionProgress from './SectionProgress.jsx';

const mistake = {
  question_id: 'q1',
  stem: 'What is the main job of mitochondria?',
  options: ['Making proteins', 'Producing ATP'],
  answer_index: 1,
  selected_index: 0,
  explanation: 'They produce ATP.',
  anchor_section: '2.3 Organelles',
};

describe('SectionProgress', () => {
  it('renders nothing before anything has been answered', () => {
    const { container, rerender } = render(<SectionProgress progress={{ by_type: [], mistakes: [], reread: [] }} />);
    expect(container.innerHTML).toBe('');

    rerender(<SectionProgress progress={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows accuracy by question type under the Correctness heading', () => {
    render(
      <SectionProgress
        progress={{ by_type: [{ type: 'MULTIPLE_CHOICE', total: 4, correct: 3 }], mistakes: [], reread: [] }}
      />
    );

    expect(screen.getByText('Correctness')).toBeTruthy();
    expect(screen.getByText(/3\/4/)).toBeTruthy();
  });

  it('lists the parts worth re-reading and the mistakes still open', () => {
    render(
      <SectionProgress
        progress={{
          by_type: [{ type: 'MULTIPLE_CHOICE', total: 1, correct: 0 }],
          mistakes: [mistake],
          reread: [{ anchor_section: '2.3 Organelles', mistake_count: 1, excerpts: ['Mitochondria produce ATP.'] }],
        }}
      />
    );

    expect(screen.getByText('Worth re-reading')).toBeTruthy();
    expect(screen.getByText('1 question still wrong')).toBeTruthy();
    expect(screen.getByText('Still to fix')).toBeTruthy();
    expect(screen.getByText('You answered: Making proteins')).toBeTruthy();
    expect(screen.getByText('Correct: Producing ATP')).toBeTruthy();
    expect(screen.getByText('Re-read: 2.3 Organelles')).toBeTruthy();
  });
});
