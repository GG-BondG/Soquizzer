import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { cannedReply } from './cannedReply.js';

const GENERIC_GREETING = 'Hi! I\'m your study assistant. Ask me anything.';
const QUESTION_GREETING = 'Stuck on this one? Ask me anything about it.';

// The chat with the assistant: its messages, the open/closed panel and the message being typed. While a question is
// on screen (`askAbout`) the reply comes from the real tutor endpoint; otherwise it is a light, local canned one.
// `showBubble` is where a reply is also announced.
export function useAssistantChat({ showBubble }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', text: GENERIC_GREETING }]);
  // Which question (if any) the quiz page currently has on screen; set via askAbout/stopAsking below.
  const [askContext, setAskContext] = useState(null); // { quizId, questionId } | null

  // The quiz page calls this with the question currently on screen. A new question starts a fresh conversation.
  // Returns the same object when nothing changed so calling it on every render cannot loop.
  const askAbout = useCallback((quizId, questionId) => {
    setAskContext((prev) => (prev?.quizId === quizId && prev?.questionId === questionId ? prev : { quizId, questionId }));
  }, []);
  const stopAsking = useCallback(() => setAskContext(null), []);
  const openChat = useCallback(() => setOpen(true), []);
  const toggle = useCallback(() => setOpen((isOpen) => !isOpen), []);
  const addAssistantMessage = useCallback(
    (text) => setMessages((current) => [...current, { role: 'assistant', text }]),
    []
  );

  useEffect(() => {
    setMessages([{ role: 'assistant', text: askContext ? QUESTION_GREETING : GENERIC_GREETING }]);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askContext?.quizId, askContext?.questionId]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage = { role: 'user', text: trimmed };
    setInput('');

    if (!askContext) {
      const assistantMessage = { role: 'assistant', text: cannedReply(trimmed) };
      setMessages((current) => [...current, userMessage, assistantMessage]);
      showBubble(assistantMessage.text);
      return;
    }

    // The backend keeps no state between calls, so the transcript so far goes along on every turn. Its role
    // names are 'student' and 'pet', whatever the frontend calls them.
    const history = messages.map((m) => ({ role: m.role === 'user' ? 'student' : 'pet', text: m.text }));
    setMessages((current) => [...current, userMessage]);
    setSending(true);
    try {
      const { reply } = await api.chat.ask(askContext.quizId, askContext.questionId, { message: trimmed, history });
      addAssistantMessage(reply);
      showBubble(reply);
    } catch (err) {
      const text = `I couldn't reach the server: ${err.message}`;
      addAssistantMessage(text);
      showBubble(text);
    } finally {
      setSending(false);
    }
  }, [addAssistantMessage, askContext, input, messages, sending, showBubble]);

  return { open, setOpen, toggle, openChat, input, setInput, sending, messages, send, askAbout, stopAsking, addAssistantMessage };
}
