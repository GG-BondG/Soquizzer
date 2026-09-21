import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import Live2DPet from './Live2DPet.jsx';
import ChatPanel from './ChatPanel.jsx';
import { CORRECT_LINES, WRONG_LINES, pickLine } from './encouragements.js';
import { useAssistantChat } from './useAssistantChat.js';
import { useBubble } from './useBubble.js';

const noop = () => {};
const AssistantContext = createContext({
  cheer: noop,
  loading: noop,
  success: noop,
  error: noop,
  idle: noop,
  answerResult: noop,
  askAbout: noop,
  stopAsking: noop,
  openChat: noop,
});

// The assistant lives above the router so it stays on screen while the student moves between pages.
// What pages get from `useAssistant()` is only actions, all with a stable identity: typing in the chat box or a
// new bubble never changes it, so a page that depends on it does not re-render or re-run its effects.
export function AssistantProvider({ children }) {
  const assistantRef = useRef(null);
  const lastLineId = useRef(null);
  const { bubble, showBubble, clearBubble } = useBubble();
  const chat = useAssistantChat({ showBubble });
  const { toggle, addAssistantMessage } = chat;

  const handleAssistantTap = useCallback(() => {
    toggle();
    clearBubble();
  }, [toggle, clearBubble]);

  // Say a random line from `lines`, in text and (if the clip exists) voice. Returns the line.
  const say = useCallback(
    (lines) => {
      const line = pickLine(lines, lastLineId.current);
      lastLineId.current = line.id;
      showBubble(line.text);
      assistantRef.current?.perform(`${import.meta.env.BASE_URL}voice/${line.id}.wav`);
      return line;
    },
    [showBubble]
  );

  // Call when the student answers correctly: a random encouraging line.
  const cheer = useCallback(() => say(CORRECT_LINES), [say]);

  // Right or wrong, the assistant answers in voice. A `text` replaces the line in the bubble (used for the quiz score),
  // but the voice line is still spoken.
  const answerResult = useCallback(
    (correct, text) => {
      const line = say(correct ? CORRECT_LINES : WRONG_LINES);
      if (text) showBubble(text);
      if (!correct) addAssistantMessage(text ?? line.text);
    },
    [say, showBubble, addAssistantMessage]
  );

  // Status messages for backend work. `loading` stays until the next message replaces it.
  const loading = useCallback((text) => showBubble(text, { sticky: true }), [showBubble]);
  const message = useCallback((text) => showBubble(text), [showBubble]);
  const idle = useCallback((text) => (text ? showBubble(text) : showBubble(null, { sticky: true })), [showBubble]);

  const { askAbout, stopAsking, openChat } = chat;
  const value = useMemo(
    () => ({ cheer, loading, success: message, error: message, idle, answerResult, askAbout, stopAsking, openChat }),
    [cheer, loading, message, idle, answerResult, askAbout, stopAsking, openChat]
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
      <div className="pet-shell">
        {chat.open && (
          <ChatPanel
            messages={chat.messages}
            sending={chat.sending}
            input={chat.input}
            onInputChange={chat.setInput}
            onSend={chat.send}
            onClose={() => chat.setOpen(false)}
          />
        )}
        <Live2DPet ref={assistantRef} bubble={bubble} onTap={handleAssistantTap} />
      </div>
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  return useContext(AssistantContext);
}

export const PetProvider = AssistantProvider;
export const usePet = useAssistant;
