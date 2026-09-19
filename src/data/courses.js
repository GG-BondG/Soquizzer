// Seed data standing in for the real backend. Shape this the way your
// course-object model actually looks once the backend team's API exists --
// the UI below only reads these fields, so swapping this file for a fetch()
// is the whole integration.

export const courses = [
  {
    code: 'MAT102',
    title: 'Calculus II',
    textbook: 'Stewart, Calculus, 8th ed.',
    syllabus: 'syllabus.pdf',
    sections: [
      { title: 'Limits and Continuity', decks: 3, pdfs: 1 },
      { title: 'Derivatives', decks: 4, pdfs: 0 },
      { title: 'Applications of Derivatives', decks: 2, pdfs: 2 },
      { title: 'Integration Basics', decks: 3, pdfs: 1 },
    ],
    papers: [{ name: 'MAT102-midterm-2024.pdf', size: 482113, addedAt: '2026-09-10T12:00:00.000Z' }],
    quizStats: {
      trivia: { label: '8/10 correct', time: '2m' },
      exam: { label: '72%', time: '34m' },
    },
    recentActivity: [
      { type: 'exam', label: 'Mock Exam', result: '72% correct', time: '34m', date: 'Sep 17' },
      { type: 'trivia', label: 'Warm-up Trivia', result: '8/10 correct', time: '2m', date: 'Sep 17' },
      { type: 'exam', label: 'Mock Exam', result: '65% correct', time: '41m', date: 'Sep 12' },
    ],
  },
  {
    code: 'STA256',
    title: 'Probability & Statistics',
    textbook: '',
    syllabus: '',
    sections: [],
    papers: [],
    quizStats: { trivia: null, exam: null },
    recentActivity: [],
  },
];
