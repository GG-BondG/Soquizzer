// What the pet says when the student answers a question correctly.
// Each line has a voice clip at public/voice/<id>.wav (see public/voice/README.md). Without the clip the pet
// still shows the text, so lines can be added or reworded here without touching any other code.
export const CORRECT_LINES = [
  { id: 'correct-01', text: '干就完事了！这题拿下！' },
  { id: 'correct-02', text: '太棒了！继续保持！' },
  { id: 'correct-03', text: '快了快了，胜利就在眼前！' },
  { id: 'correct-04', text: '哇，你也太会了吧！我都被你迷住啦～' },
  { id: 'correct-05', text: '对啦对啦！不愧是你！' },
  { id: 'correct-06', text: '就是这个感觉！别停，继续冲！' },
  { id: 'correct-07', text: '答得漂亮！奖励你一个比心～' },
  { id: 'correct-08', text: '稳住稳住，你今天状态爆棚！' },
];

// A random line, never the same one twice in a row.
export function pickLine(lines, previousId) {
  const choices = lines.length > 1 ? lines.filter((line) => line.id !== previousId) : lines;
  return choices[Math.floor(Math.random() * choices.length)];
}
