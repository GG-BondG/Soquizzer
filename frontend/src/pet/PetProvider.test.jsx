import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantProvider, useAssistant } from './PetProvider.jsx';

vi.mock('./Live2DPet.jsx', () => ({
  default: ({ bubble, onTap }) => (
    <button type="button" onClick={onTap} data-testid="pet-button">
      {bubble ?? 'no-bubble'}
    </button>
  ),
}));

function AssistantProbe({ onClick }) {
  const assistant = useAssistant();
  return (
    <button type="button" data-testid="probe" onClick={() => onClick(assistant)}>
      probe
    </button>
  );
}

describe('AssistantProvider', () => {
  it('opens the assistant chat when the assistant is tapped', () => {
    render(
      <AssistantProvider>
        <div>page</div>
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));

    expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();
  });

  it('opens a chat panel and lets the user send a message', () => {
    render(
      <AssistantProvider>
        <div>page</div>
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));
    fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getAllByText(/hey there|i'm ready to help/i).length).toBeGreaterThan(0);
  });

  it('keeps only one dialog open when the assistant is tapped', () => {
    render(
      <AssistantProvider>
        <div>page</div>
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));

    expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();
    expect(screen.queryByText(/I'm here when you need me/i)).toBeNull();
  });

  it('reacts differently to correct and wrong answers', () => {
    const { unmount } = render(
      <AssistantProvider>
        <AssistantProbe onClick={(assistant) => assistant.answerResult(true, 'Correct! Great job!')} />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('probe'));
    expect(screen.queryByText('Correct! Great job!')).toBeNull();
    unmount();

    render(
      <AssistantProvider>
        <AssistantProbe onClick={(assistant) => assistant.answerResult(false, 'Not quite. Try again!')} />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));
    fireEvent.click(screen.getByTestId('probe'));
    expect(screen.getByText('Not quite. Try again!')).toBeTruthy();
  });
});
