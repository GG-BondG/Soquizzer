import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api.js';
import { PetProvider, usePet } from './PetProvider.jsx';

vi.mock('./Live2DPet.jsx', () => ({
  default: ({ bubble, onTap }) => (
    <button type="button" onClick={onTap} data-testid="pet-button">
      {bubble ?? 'no-bubble'}
    </button>
  ),
}));

vi.mock('../api.js', () => ({
  api: { chat: { ask: vi.fn() } },
}));

// A fresh vi.fn() per test, rather than api.chat.ask.mockReset()/mockClear() on a shared instance: calling
// mockReset/mockClear in beforeEach and later mockImplementation-ing a synchronous throw in the test body
// triggers a Vitest/tinyspy issue where the promise's own try/catch (confirmed to run via tracing) still gets
// reported as an unhandled/uncaught error. Reassigning the mock avoids it entirely and keeps tests isolated.
beforeEach(() => {
  api.chat.ask = vi.fn();
});

function PetProbe({ onClick }) {
  const pet = usePet();
  return (
    <button type="button" data-testid="probe" onClick={() => onClick(pet)}>
      probe
    </button>
  );
}

// Wrapped in an async act() so the promise inside submitChat settles (and is caught) before the test moves on,
// instead of leaking past a synchronous fireEvent.click into an unhandled rejection.
async function send(text) {
  fireEvent.change(screen.getByPlaceholderText('Ask your pet...'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByText('Send'));
  });
}

describe('PetProvider', () => {
  it('opens the pet chat when the pet is tapped', () => {
    render(
      <PetProvider>
        <div>page</div>
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));

    expect(screen.getByRole('dialog', { name: 'Pet chat' })).toBeTruthy();
  });

  it('opens a chat panel and lets the user send a message', () => {
    render(
      <PetProvider>
        <div>page</div>
      </PetProvider>
    );

    fireEvent.click(screen.getByTestId('pet-button'));
    fireEvent.change(screen.getByPlaceholderText('Ask your pet...'), { target: { value: 'hello' } });
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

    expect(screen.getByRole('dialog', { name: 'Pet chat' })).toBeTruthy();
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

  describe('asking about the question on screen', () => {
    it('greets with a question-specific line once askAbout is called', () => {
      render(
        <PetProvider>
          <PetProbe onClick={(pet) => pet.askAbout('quiz1', 'q1')} />
        </PetProvider>
      );

      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('pet-button'));

      expect(screen.getByText('Stuck on this one? Ask me anything about it.')).toBeTruthy();
    });

    it('calls the real backend (not the canned replies) once a question is active', async () => {
      api.chat.ask.mockResolvedValue({ reply: 'Think about what each organelle does.' });
      render(
        <PetProvider>
          <PetProbe onClick={(pet) => pet.askAbout('quiz1', 'q1')} />
        </PetProvider>
      );
      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('pet-button'));

      await send('why not option 2?');

      expect(screen.getAllByText('Think about what each organelle does.').length).toBeGreaterThan(0);
      expect(api.chat.ask).toHaveBeenCalledWith('quiz1', 'q1', {
        message: 'why not option 2?',
        history: [{ role: 'pet', text: 'Stuck on this one? Ask me anything about it.' }],
      });
    });

    it('shows a friendly message if the chat request fails', async () => {
      api.chat.ask.mockRejectedValue(new Error('Request timed out'));
      render(
        <PetProvider>
          <PetProbe onClick={(pet) => pet.askAbout('quiz1', 'q1')} />
        </PetProvider>
      );
      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('pet-button'));

      await send('help');

      expect(screen.getAllByText(/couldn't reach the server: Request timed out/).length).toBeGreaterThan(0);
    });

    it('closes the chat and starts a fresh conversation when the active question changes', () => {
      function AskSwitcher() {
        const pet = usePet();
        return (
          <>
            <button type="button" data-testid="ask-q1" onClick={() => pet.askAbout('quiz1', 'q1')}>
              ask q1
            </button>
            <button type="button" data-testid="ask-q2" onClick={() => pet.askAbout('quiz1', 'q2')}>
              ask q2
            </button>
          </>
        );
      }

      render(
        <PetProvider>
          <AskSwitcher />
        </PetProvider>
      );

      fireEvent.click(screen.getByTestId('ask-q1'));
      fireEvent.click(screen.getByTestId('pet-button'));
      expect(screen.getByRole('dialog', { name: 'Pet chat' })).toBeTruthy();

      fireEvent.click(screen.getByTestId('ask-q2'));

      expect(screen.queryByRole('dialog', { name: 'Pet chat' })).toBeNull();
    });

    it('falls back to the canned reply once stopAsking is called', async () => {
      function Controls() {
        const pet = usePet();
        return (
          <>
            <button type="button" data-testid="ask" onClick={() => pet.askAbout('quiz1', 'q1')}>
              ask
            </button>
            <button type="button" data-testid="stop" onClick={() => pet.stopAsking()}>
              stop
            </button>
          </>
        );
      }

      render(
        <PetProvider>
          <Controls />
        </PetProvider>
      );

      fireEvent.click(screen.getByTestId('ask'));
      fireEvent.click(screen.getByTestId('stop'));
      fireEvent.click(screen.getByTestId('pet-button'));

      await send('hello');

      expect(api.chat.ask).not.toHaveBeenCalled();
      expect(screen.getAllByText(/hey there|i'm ready to help/i).length).toBeGreaterThan(0);
    });
  });
});
