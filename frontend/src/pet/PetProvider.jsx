import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import Live2DPet from './Live2DPet.jsx';
import { CORRECT_LINES, WRONG_LINES, pickLine } from './encouragements.js';

const BUBBLE_MS = 3500;
const GENERIC_GREETING = 'Hi! I\'m your study assistant. Ask me anything.';
const QUESTION_GREETING = 'Stuck on this one? Ask me anything about it.';
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
  askAbout: noop,
  stopAsking: noop,
});

// Used only when no question is on screen (e.g. the student taps the pet on another page): a light, local
// canned reply. Once a question is active, submitChat calls the real Gemini-backed endpoint instead.
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
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', text: GENERIC_GREETING }]);
  // Which question (if any) the quiz page currently has on screen; set via askAbout/stopAsking below.
  const [askContext, setAskContext] = useState(null); // { quizId, questionId } | null

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

  // The quiz page calls this with the question currently on screen; the pet then answers about that question
  // for real instead of giving a canned reply. A new question starts a fresh conversation.
  // Bails out to the same object when nothing changed: the caller (QuizPage) re-runs this on every render of
  // the pet context (e.g. each keystroke in the chat box changes the context's identity), and returning a new object
  // literal every time here would re-trigger that same context change right back — an infinite loop.
  const askAbout = useCallback((quizId, questionId) => {
    setAskContext((prev) => (prev?.quizId === quizId && prev?.questionId === questionId ? prev : { quizId, questionId }));
  }, []);
  const stopAsking = useCallback(() => setAskContext(null), []);

  useEffect(() => {
    setMessages([{ role: 'assistant', text: askContext ? QUESTION_GREETING : GENERIC_GREETING }]);
    setChatOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askContext?.quizId, askContext?.questionId]);

  const submitChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatSending) return;

    const userMessage = { role: 'user', text: trimmed };
    setChatInput('');

    if (!askContext) {
      const assistantMessage = { role: 'assistant', text: pickReply(trimmed) };
      setMessages((current) => [...current, userMessage, assistantMessage]);
      showBubble(assistantMessage.text);
      return;
    }

    // The backend keeps no state between calls, so the transcript so far goes along on every turn. Its role
    // names are 'student' and 'pet', whatever the frontend calls them.
    const history = messages.map((m) => ({ role: m.role === 'user' ? 'student' : 'pet', text: m.text }));
    setMessages((current) => [...current, userMessage]);
    setChatSending(true);
    try {
      const { reply } = await api.chat.ask(askContext.quizId, askContext.questionId, { message: trimmed, history });
      setMessages((current) => [...current, { role: 'assistant', text: reply }]);
      showBubble(reply);
    } catch (err) {
      const text = `I couldn't reach the server: ${err.message}`;
      setMessages((current) => [...current, { role: 'assistant', text }]);
      showBubble(text);
    } finally {
      setChatSending(false);
    }
  }, [askContext, chatInput, chatSending, messages, showBubble]);

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
      if (!correct) setMessages((current) => [...current, { role: 'assistant', text: text ?? line.text }]);
    },
    [say, showBubble]
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
      askAbout,
      stopAsking,
      openChat: () => setChatOpen(true),
      chat: {
        open: chatOpen,
        setOpen: setChatOpen,
        messages,
        setMessages,
        input: chatInput,
        setInput: setChatInput,
        send: submitChat,
        sending: chatSending,
      },
    }),
    [answerResult, askAbout, chatInput, chatOpen, chatSending, cheer, messages, showBubble, stopAsking, submitChat]
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
            <div className="pet-chat-message-list">
              {messages.map((msg, index) => (
                <div key={`${msg.role}-${index}`} className={`pet-chat-message pet-chat-message-${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              {chatSending && <div className="pet-chat-message pet-chat-message-assistant pet-chat-message-thinking">…</div>}
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
                disabled={chatSending}
              />
              <button type="button" onClick={submitChat} disabled={chatSending || !chatInput.trim()}>
                Send
              </button>
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
