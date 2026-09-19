// What the pet says when the student answers a question correctly (CORRECT_LINES) or wrongly (WRONG_LINES).
// Each line has a voice clip at public/voice/<id>.wav (see public/voice/README.md). Without the clip the pet
// still shows the text, so lines can be added or reworded here without touching any other code.
// The ids must stay `correct-NN` / `wrong-NN`: tools/voice/make_voice.py finds the lines by that pattern.
export const CORRECT_LINES = [
  { id: 'correct-01', text: "Let's do this! You've got it!" },
  { id: 'correct-02', text: 'Amazing! Keep it up!' },
  { id: 'correct-03', text: 'Almost there, victory is right ahead!' },
  { id: 'correct-04', text: "Wow, you're so good, I'm smitten!" },
  { id: 'correct-05', text: "That's the one! Nice work, champ!" },
  { id: 'correct-06', text: "That's the feeling! Don't stop now!" },
  { id: 'correct-07', text: "Beautifully done! Here's a heart for you!" },
  { id: 'correct-08', text: "Steady now, you're on fire today!" },
];

// Comfort with a little flirting: a wrong answer should sting less than a smile.
export const WRONG_LINES = [
  { id: 'wrong-01', text: "Aww, so bad! But don't worry, I still like you." },
  { id: 'wrong-02', text: 'Oh no, so bad! Next time, okay? I believe in you.' },
  { id: 'wrong-03', text: "Missed one? Come here, I'll give you a virtual hug!" },
  { id: 'wrong-04', text: "So bad! But you're cute when you try, so it's fine." },
  { id: 'wrong-05', text: "Wrong answer, right person. Let's get the next one!" },
  { id: 'wrong-06', text: 'Chin up, even the smartest ones slip. You got this next time!' },
  { id: 'wrong-07', text: 'Ouch, so bad! Let me make it up to you on the next question.' },
  { id: 'wrong-08', text: "Wrong this time, but you're still my favorite. Do better next time!" },
];

// A random line, never the same one twice in a row.
export function pickLine(lines, previousId) {
  const choices = lines.length > 1 ? lines.filter((line) => line.id !== previousId) : lines;
  return choices[Math.floor(Math.random() * choices.length)];
}
