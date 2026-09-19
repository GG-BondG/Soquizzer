import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useImperativeHandle } from 'react';
import { api } from '../api.js';
import { AssistantProvider, useAssistant } from './AssistantProvider.jsx';
import { CORRECT_LINES, WRONG_LINES } from './encouragements.js';

const perform = vi.hoisted(() => vi.fn());

vi.mock('./Live2DAssistant.jsx', () => {
  function FakeAssistant({ ref, bubble, onTap }) {
    useImperativeHandle(ref, () => ({ perform }));
    return (
      <button type="button" onClick={onTap} data-testid="assistant-button">
        {bubble ?? 'no-bubble'}
      </button>
    );
  }
  return { default: FakeAssistant };
});

vi.mock('../api.js', () => ({
  api: { chat: { ask: vi.fn() } },
}));

beforeEach(() => {
  api.chat.ask = vi.fn();
  perform.mockClear();
});

function AssistantProbe({ onClick }) {
  const assistant = useAssistant();
  return (
    <button type="button" data-testid="probe" onClick={() => onClick(assistant)}>
      probe
    </button>
  );
}

async function send(text) {
  fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByText('Send'));
  });
}

describe('AssistantProvider', () => {
  it('opens the assistant chat when the assistant is tapped', () => {
    render(
      <AssistantProvider>
        <div>page</div>
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('assistant-button'));

    expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();
  });

  it('opens a chat panel and lets the user send a message', async () => {
    render(
      <AssistantProvider>
        <div>page</div>
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('assistant-button'));
    fireEvent.change(screen.getByPlaceholderText('Ask your assistant...'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    expect(await screen.findByText('hello')).toBeTruthy();
    expect(screen.getAllByText(/hey there|i'm ready to help/i).length).toBeGreaterThan(0);
  });

  it('does not show a duplicate floating bubble when assistant replies in chat', async () => {
    api.chat.ask.mockResolvedValue({ reply: 'Think about what each organelle does.' });
    render(
      <AssistantProvider>
        <AssistantProbe onClick={(assistant) => assistant.askAbout('quiz1', 'q1')} />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('probe'));
    fireEvent.click(screen.getByTestId('assistant-button'));
    await send('why not option 2?');

    expect(screen.getAllByText('Think about what each organelle does.')).toHaveLength(1);
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

    fireEvent.click(screen.getByTestId('assistant-button'));
    fireEvent.click(screen.getByTestId('probe'));
    expect(screen.getByText('Not quite. Try again!')).toBeTruthy();
  });

  it('speaks a voiced comforting line after a wrong answer, and a cheering one after a correct answer', () => {
    render(
      <AssistantProvider>
        <AssistantProbe onClick={(assistant) => assistant.answerResult(false)} />
        <AssistantProbe onClick={(assistant) => assistant.answerResult(true)} />
      </AssistantProvider>
    );

    const [wrong, correct] = screen.getAllByTestId('probe');
    fireEvent.click(wrong);
    const wrongLine = WRONG_LINES.find((line) => screen.queryByText(line.text));
    expect(wrongLine).toBeTruthy();
    expect(perform).toHaveBeenLastCalledWith(expect.stringContaining(`voice/${wrongLine.id}.wav`));

    fireEvent.click(correct);
    const correctLine = CORRECT_LINES.find((line) => screen.queryByText(line.text));
    expect(correctLine).toBeTruthy();
    expect(perform).toHaveBeenLastCalledWith(expect.stringContaining(`voice/${correctLine.id}.wav`));
  });

  it('still speaks the voice line on a wrong answer when a score text replaces the bubble', () => {
    render(
      <AssistantProvider>
        <AssistantProbe onClick={(assistant) => assistant.answerResult(false, '1 out of 5.')} />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByTestId('probe'));

    expect(screen.getByText('1 out of 5.')).toBeTruthy();
    expect(perform).toHaveBeenCalledWith(expect.stringMatching(/voice\/wrong-\d+\.wav$/));
  });

  describe('asking about the question on screen', () => {
    it('greets with a question-specific line once askAbout is called', () => {
      render(
        <AssistantProvider>
          <AssistantProbe onClick={(assistant) => assistant.askAbout('quiz1', 'q1')} />
        </AssistantProvider>
      );

      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('assistant-button'));

      expect(screen.getByText('Stuck on this one? Ask me anything about it.')).toBeTruthy();
    });

    it('calls the real backend once a question is active', async () => {
      api.chat.ask.mockResolvedValue({ reply: 'Think about what each organelle does.' });
      render(
        <AssistantProvider>
          <AssistantProbe onClick={(assistant) => assistant.askAbout('quiz1', 'q1')} />
        </AssistantProvider>
      );
      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('assistant-button'));

      await send('why not option 2?');

      expect(screen.getAllByText('Think about what each organelle does.').length).toBeGreaterThan(0);
      expect(api.chat.ask).toHaveBeenCalledWith('quiz1', 'q1', {
        message: 'why not option 2?',
        history: [{ role: 'assistant', text: 'Stuck on this one? Ask me anything about it.' }],
      });
    });

    it('shows a friendly message if the chat request fails', async () => {
      api.chat.ask.mockRejectedValue(new Error('Request timed out'));
      render(
        <AssistantProvider>
          <AssistantProbe onClick={(assistant) => assistant.askAbout('quiz1', 'q1')} />
        </AssistantProvider>
      );
      fireEvent.click(screen.getByTestId('probe'));
      fireEvent.click(screen.getByTestId('assistant-button'));

      await send('help');

      expect(screen.getAllByText(/couldn't reach the server: Request timed out/).length).toBeGreaterThan(0);
    });

    it('closes the chat and starts a fresh conversation when the active question changes', () => {
      function AskSwitcher() {
        const assistant = useAssistant();
        return (
          <>
            <button type="button" data-testid="ask-q1" onClick={() => assistant.askAbout('quiz1', 'q1')}>
              ask q1
            </button>
            <button type="button" data-testid="ask-q2" onClick={() => assistant.askAbout('quiz1', 'q2')}>
              ask q2
            </button>
          </>
        );
      }

      render(
        <AssistantProvider>
          <AskSwitcher />
        </AssistantProvider>
      );

      fireEvent.click(screen.getByTestId('ask-q1'));
      fireEvent.click(screen.getByTestId('assistant-button'));
      expect(screen.getByRole('dialog', { name: 'Assistant chat' })).toBeTruthy();

      fireEvent.click(screen.getByTestId('ask-q2'));

      expect(screen.queryByRole('dialog', { name: 'Assistant chat' })).toBeNull();
    });

    it('falls back to the canned reply once stopAsking is called', async () => {
      function Controls() {
        const assistant = useAssistant();
        return (
          <>
            <button type="button" data-testid="ask" onClick={() => assistant.askAbout('quiz1', 'q1')}>
              ask
            </button>
            <button type="button" data-testid="stop" onClick={() => assistant.stopAsking()}>
              stop
            </button>
          </>
        );
      }

      render(
        <AssistantProvider>
          <Controls />
        </AssistantProvider>
      );

      fireEvent.click(screen.getByTestId('ask'));
      fireEvent.click(screen.getByTestId('stop'));
      fireEvent.click(screen.getByTestId('assistant-button'));

      await send('hello');

      expect(api.chat.ask).not.toHaveBeenCalled();
      expect(screen.getAllByText(/hey there|i'm ready to help/i).length).toBeGreaterThan(0);
    });

    it('does not loop when askAbout is called on every render', () => {
      let calls = 0;
      function ReAsker() {
        const assistant = useAssistant();
        useEffect(() => {
          calls += 1;
          assistant.askAbout('quiz1', 'q1');
        });
        return null;
      }

      render(
        <AssistantProvider>
          <ReAsker />
        </AssistantProvider>
      );

      expect(calls).toBeLessThan(10);
    });
  });
});
