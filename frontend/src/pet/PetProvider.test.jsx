import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PetProvider, usePet } from './PetProvider.jsx';

vi.mock('./Live2DPet.jsx', () => ({
  default: ({ bubble, onTap }) => (
    <button type="button" onClick={onTap} data-testid="pet-button">
      {bubble ?? 'no-bubble'}
    </button>
  ),
}));

function PetProbe({ onClick }) {
  const pet = usePet();
  return (
    <button type="button" data-testid="probe" onClick={() => onClick(pet)}>
      probe
    </button>
  );
}

describe('PetProvider', () => {
  it('opens the assistant chat when the pet is tapped', () => {
    render(
      <PetProvider>
        <div>page</div>
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));

    expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();
  });

  it('opens a chat panel and lets the user send a message', () => {
    render(
      <PetProvider>
        <div>page</div>
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));
    fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getAllByText(/hey there|i'm ready to help/i).length).toBeGreaterThan(0);
  });

  it('keeps only one dialog open when the pet is tapped', () => {
    render(
      <PetProvider>
        <div>page</div>
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));

    expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();
    expect(screen.queryByText(/I'm here when you need me/i)).toBeNull();
  });

  it('reacts differently to correct and wrong answers', () => {
    const { unmount } = render(
      <PetProvider>
        <PetProbe onClick={(pet) => pet.answerResult(true, 'Correct! Great job!')} />
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('probe'));
    expect(screen.getByText('Correct! Great job!')).toBeTruthy();
    unmount();

    render(
      <PetProvider>
        <PetProbe onClick={(pet) => pet.answerResult(false, 'Not quite. Try again!')} />
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('probe'));
    expect(screen.getByText('Not quite. Try again!')).toBeTruthy();
  });
});
