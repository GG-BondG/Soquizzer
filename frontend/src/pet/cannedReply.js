// Used only when no question is on screen (e.g. the student taps the pet on another page): a light, local canned
// reply. The first rule that matches wins. English words are matched as whole words, so "this" is not "hi".
const RULES = [
  { test: /\b(hello|hi|hey)\b|你好|嗨/i, reply: () => 'Hey there! I\'m ready to help.' },
  { test: /\b(correct|right|yes|ok)\b|对|正确/i, reply: () => 'Exactly! That\'s the right direction.' },
  { test: /\b(wrong|no|not)\b|错误|不对|错/i, reply: () => 'No worries — we can fix it together.' },
  { test: /\b(study|learn|quiz)\b|复习|学习|题|练习/i, reply: () => 'Perfect. Let\'s make it a small, easy win.' },
];

const FALLBACKS = [
  'I can help you break it down step by step.',
  'Nice question. Let\'s tackle it together.',
  'You\'ve got this — I\'m here to help.',
  'Let\'s keep it simple and focus on one idea at a time.',
];

export function cannedReply(message) {
  const text = (message || '').trim();
  if (!text) return 'I\'m listening. Tell me what you\'re stuck on.';
  const rule = RULES.find((r) => r.test.test(text));
  return rule ? rule.reply() : FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}
