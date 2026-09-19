import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import Live2DAssistant from './Live2DAssistant.jsx';
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

function pickReply(message) {
  const text = (message || '').trim();
  if (!text) return 'I\'m listening. Tell me what you\'re stuck on.';
  if (/hello|hi|hey|你好|嗨/i.test(text)) return 'Hey there! I\'m ready to help.';
  if (/correct|right|yes|对|正确|ok/i.test(text)) return 'Exactly! That\'s the right direction.';
  if (/wrong|no|错误|不对|错|not/i.test(text)) return 'No worries — we can fix it together.';
  if (/study|learn|复习|学习|quiz|题|练习/i.test(text)) return 'Perfect. Let\'s make it a small, easy win.';
  return ASSISTANT_REPLIES[Math.floor(Math.random() * ASSISTANT_REPLIES.length)];
}

export function AssistantProvider({ children }) {
  const assistantRef = useRef(null);
  const messageListRef = useRef(null);
  const lastLineId = useRef(null);
  const hideTimer = useRef(null);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', text: GENERIC_GREETING }]);
  const [askContext, setAskContext] = useState(null); // { quizId, questionId } | null

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, chatOpen]);

  const showBubble = useCallback((text, { sticky = false } = {}) => {
    clearTimeout(hideTimer.current);
    setBubble(text);
    if (!sticky) hideTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  const handleAssistantTap = useCallback(() => {
    setChatOpen((open) => !open);
    setBubble(null);
  }, []);

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
      return;
    }

    const history = messages.map((m) => ({ role: m.role === 'user' ? 'student' : 'assistant', text: m.text }));
    setMessages((current) => [...current, userMessage]);
    setChatSending(true);
    try {
      const { reply } = await api.chat.ask(askContext.quizId, askContext.questionId, { message: trimmed, history });
      setMessages((current) => [...current, { role: 'assistant', text: reply }]);
    } catch (err) {
      const text = `I couldn't reach the server: ${err.message}`;
      setMessages((current) => [...current, { role: 'assistant', text }]);
    } finally {
      setChatSending(false);
    }
  }, [askContext, chatInput, chatSending, messages, showBubble]);

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

  const cheer = useCallback(() => say(CORRECT_LINES), [say]);

  const answerResult = useCallback(
    (correct, text) => {
      if (correct) {
        cheer();
        return;
      }

      const line = say(WRONG_LINES);
      if (text) showBubble(text);
      else showBubble(line.text);
    },
    [say, showBubble]
  );

  const value = useMemo(
    () => ({
      cheer,
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
      <div className="assistant-shell">
        {chatOpen && (
          <div className="assistant-chat-panel" role="dialog" aria-label="Assistant chat">
            <div className="assistant-chat-header">
              <span>Study assistant</span>
              <button type="button" className="assistant-chat-close" onClick={() => setChatOpen(false)} aria-label="Close assistant chat">
                ×
              </button>
            </div>
            <div ref={messageListRef} className="assistant-chat-message-list">
              {messages.map((msg, index) => (
                <div key={`${msg.role}-${index}`} className={`assistant-chat-message assistant-chat-message-${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              {chatSending && <div className="assistant-chat-message assistant-chat-message-assistant assistant-chat-message-thinking">…</div>}
            </div>
            <div className="assistant-chat-form">
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
        <Live2DAssistant ref={assistantRef} bubble={bubble} onTap={handleAssistantTap} />
      </div>
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  return useContext(AssistantContext);
}
