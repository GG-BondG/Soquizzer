import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Live2DPet from './Live2DPet.jsx';
import { CORRECT_LINES, pickLine } from './encouragements.js';

const BUBBLE_MS = 3500;
const PET_REPLIES = [
  'I can help you break it down step by step.',
  'Nice question. Let\'s tackle it together.',
  'You\'ve got this — I\'m here to help.',
  'Let\'s keep it simple and focus on one idea at a time.',
];

const noop = () => {};
const PetContext = createContext({
  cheer: noop,
  loading: noop,
  success: noop,
  error: noop,
  idle: noop,
  answerResult: noop,
});

function pickReply(message) {
  const text = (message || '').trim();
  if (!text) return 'I\'m listening. Tell me what you\'re stuck on.';
  if (/hello|hi|hey|你好|嗨/i.test(text)) return 'Hey there! I\'m ready to help.';
  if (/correct|right|yes|对|正确|ok/i.test(text)) return 'Exactly! That\'s the right direction.';
  if (/wrong|no|错误|不对|错|not/i.test(text)) return 'No worries — we can fix it together.';
  if (/study|learn|复习|学习|quiz|题|练习/i.test(text)) return 'Perfect. Let\'s make it a small, easy win.';
  return PET_REPLIES[Math.floor(Math.random() * PET_REPLIES.length)];
}

// The pet lives above the router so it stays on screen while the student moves between pages.
export function PetProvider({ children }) {
  const petRef = useRef(null);
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'pet', text: 'Hi! I\'m your study buddy. Ask me anything.' },
  ]);

  // Show `text` in the bubble; it fades after BUBBLE_MS unless `sticky` (used while waiting on the backend).
  const showBubble = useCallback((text, { sticky = false } = {}) => {
    clearTimeout(hideTimer.current);
    setBubble(text);
    if (!sticky) hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  const handlePetTap = useCallback(() => {
    setChatOpen((open) => !open);
    setBubble(null);
  }, []);

  const submitChat = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const userMessage = { role: 'user', text: trimmed };
    const petMessage = { role: 'pet', text: pickReply(trimmed) };
    setMessages((current) => [...current, userMessage, petMessage]);
    setChatInput('');
    showBubble(petMessage.text);
  }, [chatInput, showBubble]);

  // Call when the student answers correctly: a random encouraging line, in text and (if the clip exists) voice.
  const cheer = useCallback(() => {
    const line = pickLine(CORRECT_LINES, lastLineId.current);
    lastLineId.current = line.id;
    showBubble(line.text);
    petRef.current?.perform(`${import.meta.env.BASE_URL}voice/${line.id}.wav`);
  }, [showBubble]);

  const answerResult = useCallback(
    (correct, text) => {
      if (correct) {
        cheer();
        if (text) showBubble(text);
        return;
      }

      const message = text ?? 'Almost there — let\'s review that one.';
      setMessages((current) => [...current, { role: 'pet', text: message }]);
      showBubble(message);
    },
    [cheer, showBubble]
  );

  const value = useMemo(
    () => ({
      cheer,
      // Status messages for backend work. `loading` stays until the next message replaces it.
      loading: (text) => showBubble(text, { sticky: true }),
      success: (text) => showBubble(text),
      error: (text) => showBubble(text),
      idle: (text) => (text ? showBubble(text) : showBubble(null, { sticky: true })),
      answerResult,
      openChat: () => setChatOpen(true),
      chat: { open: chatOpen, setOpen: setChatOpen, messages, setMessages, input: chatInput, setInput: setChatInput, send: submitChat },
    }),
    [answerResult, chatInput, chatOpen, cheer, messages, showBubble, submitChat]
  );

  return (
    <PetContext.Provider value={value}>
      {children}
      <div className="pet-shell">
        {chatOpen && (
          <div className="pet-chat-panel" role="dialog" aria-label="Pet chat">
            <div className="pet-chat-header">
              <span>Study buddy</span>
              <button type="button" className="pet-chat-close" onClick={() => setChatOpen(false)} aria-label="Close pet chat">
                ×
              </button>
            </div>
            <div className="pet-chat-message-list">
              {messages.map((msg, index) => (
                <div key={`${msg.role}-${index}`} className={`pet-chat-message pet-chat-message-${msg.role}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="pet-chat-form">
              <input
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitChat();
                  }
                }}
                placeholder="Ask your pet..."
                aria-label="Message the pet"
              />
              <button type="button" onClick={submitChat}>Send</button>
            </div>
          </div>
        )}
        <Live2DPet ref={petRef} bubble={bubble} onTap={handlePetTap} />
      </div>
    </PetContext.Provider>
  );
}

export function usePet() {
  return useContext(PetContext);
}
