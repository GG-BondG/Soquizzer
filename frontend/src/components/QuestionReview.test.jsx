import { render, screen } from '@testing-library/react';
import QuestionReview from './QuestionReview.jsx';

const base = {
  number: 3,
  type: 'MULTIPLE_CHOICE',
  stem: 'What makes ATP?',
  options: ['Golgi', 'Mitochondria', 'Nucleus', 'Ribosome'],
  answerIndex: 1,
  explanation: 'Respiration happens in the mitochondria.',
};

describe('QuestionReview', () => {
  it('marks a correct answer and shows the question', () => {
    render(<QuestionReview {...base} selectedIndex={1} />);

    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('Correct')).toBeTruthy();
    expect(screen.getByText('Multiple choice')).toBeTruthy();
    expect(screen.getByText('What makes ATP?')).toBeTruthy();
    expect(screen.getByText('Your answer · correct')).toBeTruthy();
    expect(screen.getByText('Respiration happens in the mitochondria.')).toBeTruthy();
  });

  it('marks a wrong answer and tags both the pick and the right option', () => {
    render(<QuestionReview {...base} selectedIndex={0} />);

    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByText('Correct answer')).toBeTruthy();
  });

  it('marks a question left unanswered', () => {
    render(<QuestionReview {...base} selectedIndex={null} />);

    expect(screen.getByText('Not answered')).toBeTruthy();
    expect(screen.queryByText('Your answer')).toBeNull();
    expect(screen.getByText('Correct answer')).toBeTruthy();
  });

  it('tells the student what to re-read after a wrong answer', () => {
    render(
      <QuestionReview
        {...base}
        selectedIndex={0}
        anchorSection="2.3 Organelles"
        sourceExcerpt="Mitochondria produce most of the cell's ATP."
      />
    );

    expect(screen.getByText('Re-read this · 2.3 Organelles')).toBeTruthy();
    expect(screen.getByText("Mitochondria produce most of the cell's ATP.")).toBeTruthy();
  });

  it('only calls it "from the material" after a right answer', () => {
    render(<QuestionReview {...base} selectedIndex={1} anchorSection="2.3 Organelles" sourceExcerpt="Text." />);

    expect(screen.getByText('From the material · 2.3 Organelles')).toBeTruthy();
    expect(screen.queryByText(/Re-read this/)).toBeNull();
  });

  it('shows no source block for a question without an anchor (older quizzes)', () => {
    render(<QuestionReview {...base} selectedIndex={0} anchorSection="" sourceExcerpt="" />);

    expect(screen.queryByText(/Re-read this/)).toBeNull();
    expect(screen.queryByText(/From the material/)).toBeNull();
  });
});
