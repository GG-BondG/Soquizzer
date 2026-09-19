// What the pet says when the student answers a question correctly.
// Each line has a voice clip at public/voice/<id>.wav (see public/voice/README.md). Without the clip the pet
// still shows the text, so lines can be added or reworded here without touching any other code.
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

// A random line, never the same one twice in a row.
export function pickLine(lines, previousId) {
  const choices = lines.length > 1 ? lines.filter((line) => line.id !== previousId) : lines;
  return choices[Math.floor(Math.random() * choices.length)];
}
