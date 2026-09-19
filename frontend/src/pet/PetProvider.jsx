import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Live2DPet from './Live2DPet.jsx';
import { CORRECT_LINES, pickLine } from './encouragements.js';

const BUBBLE_MS = 3500;
const ASSISTANT_REPLIES = [
  'I can help you break it down step by step.',
  'Nice question. Let\'s tackle it together.',
  'You\'ve got this — I\'m here to help.',
  'Let\'s keep it simple and focus on one idea at a time.',
];

const noop = () => {};
const AssistantContext = createContext({
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
  return ASSISTANT_REPLIES[Math.floor(Math.random() * ASSISTANT_REPLIES.length)];
}

// The assistant lives above the router so it stays on screen while the student moves between pages.
export function AssistantProvider({ children }) {
  const assistantRef = useRef(null);
  const messageListRef = useRef(null);
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I\'m your study assistant. Ask me anything.' },
  ]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, chatOpen]);

  // Show `text` in the bubble; it fades after BUBBLE_MS unless `sticky` (used while waiting on the backend).
  const showBubble = useCallback((text, { sticky = false } = {}) => {
    clearTimeout(hideTimer.current);
    setBubble(text);
    if (!sticky) hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  const handleAssistantTap = useCallback(() => {
    setChatOpen((open) => !open);
    setBubble(null);
  }, []);

  const submitChat = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const userMessage = { role: 'user', text: trimmed };
    const assistantMessage = { role: 'assistant', text: pickReply(trimmed) };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setChatInput('');
  }, [chatInput]);

  // Call when the student answers correctly: a random encouraging line, in text and (if the clip exists) voice.
  const cheer = useCallback(() => {
    const line = pickLine(CORRECT_LINES, lastLineId.current);
    lastLineId.current = line.id;
    showBubble(line.text);
    assistantRef.current?.perform(`${import.meta.env.BASE_URL}voice/${line.id}.wav`);
  }, [showBubble]);

  const answerResult = useCallback(
    (correct, text) => {
      if (correct) {
        cheer();
        return;
      }

      const message = text ?? 'Almost there — let\'s review that one.';
      showBubble(message);
    },
    [showBubble]
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
    <AssistantContext.Provider value={value}>
      {children}
      <div className="pet-shell">
        {chatOpen && (
          <div className="pet-chat-panel" role="dialog" aria-label="Assistant chat">
            <div className="pet-chat-header">
              <span>Study assistant</span>
              <button type="button" className="pet-chat-close" onClick={() => setChatOpen(false)} aria-label="Close assistant chat">
                ×
              </button>
            </div>
            <div ref={messageListRef} className="pet-chat-message-list">
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
                placeholder="Ask your assistant..."
                aria-label="Message the assistant"
              />
              <button type="button" onClick={submitChat}>Send</button>
            </div>
          </div>
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
