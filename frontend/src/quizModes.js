// The two ways to study a section. `apiType` is what gets sent to the backend when a quiz is created.
export const QUIZ_MODES = {
  trivia: {
    label: 'Trivia',
    tag: 'Warm-up',
    desc: 'Playful context questions to open the lesson',
    apiType: 'TRIVIA',
  },
  mock: {
    label: 'Mock Test',
    tag: 'Timed · graded',
    desc: 'Exam-style questions, generated fresh',
    apiType: 'MOCK_TEST',
  },
};
