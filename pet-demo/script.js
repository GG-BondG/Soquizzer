const pet = document.querySelector('#pet');
const petBubble = pet.querySelector('.pet-bubble');
const generateBtn = document.querySelector('#generateBtn');
const generateQuizBtn = document.querySelector('#generateQuizBtn');
const notes = document.querySelector('#notes');
const questionText = document.querySelector('#questionText');
const answerOptions = document.querySelector('#answerOptions');
const scoreValue = document.querySelector('#scoreValue');

const states = {
  idle: '🙂',
  loading: '🤔',
  success: '😄',
  error: '😵',
  sleeping: '💤',
};

const quizBank = [
  {
    question: 'Which step turns textbook content into searchable knowledge?',
    options: ['Compression', 'Chunking + embedding', 'Renaming files', 'Printing paper copies'],
    answer: 1,
    insight: 'Good job! Chunks keep meaning while embeddings help retrieval.',
  },
  {
    question: 'What is the best reaction when you get a question wrong?',
    options: ['Give up immediately', 'Review the idea and try again', 'Delete your notes', 'Switch subjects forever'],
    answer: 1,
    insight: 'Exactly. Mistakes are just signals for the next revision round.',
  },
  {
    question: 'Which habit makes study sessions more effective?',
    options: ['Skipping review', 'Spaced repetition and active recall', 'Reading once quickly', 'Avoiding difficult topics'],
    answer: 1,
    insight: 'Nice. Active recall helps the knowledge stick much longer.',
  },
];

let currentIndex = 0;
let score = 0;
let isLocked = false;
let idleTimer = null;

function setPetState(state, message) {
  pet.className = `pet ${state}`;
  petBubble.textContent = message;

  const face = pet.querySelector('.pet-face');
  face.innerHTML = `
    <span class="eye left"></span>
    <span class="eye right"></span>
    <span class="mouth"></span>
  `;
}

function updateScore() {
  scoreValue.textContent = `Score: ${score}`;
}

function renderQuestion() {
  const currentQuestion = quizBank[currentIndex];
  if (!currentQuestion) return;

  questionText.textContent = currentQuestion.question;
  answerOptions.innerHTML = currentQuestion.options
    .map(
      (option, index) => `
        <button type="button" class="answer-button" data-index="${index}">${index + 1}. ${option}</button>
      `,
    )
    .join('');
}

function revealAnswer(selectedIndex) {
  const currentQuestion = quizBank[currentIndex];
  const buttons = [...answerOptions.querySelectorAll('.answer-button')];

  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === currentQuestion.answer) {
      button.classList.add('correct');
    }
    if (index === selectedIndex && index !== currentQuestion.answer) {
      button.classList.add('wrong');
    }
  });

  const isCorrect = selectedIndex === currentQuestion.answer;

  if (isCorrect) {
    score += 1;
    updateScore();
    setPetState('success', `Correct! ${currentQuestion.insight}`);
  } else {
    setPetState('error', `Not quite. The right answer is: ${currentQuestion.options[currentQuestion.answer]}. Keep going!`);
  }

  setTimeout(() => {
    currentIndex = (currentIndex + 1) % quizBank.length;
    renderQuestion();
    isLocked = false;
    setPetState('idle', isCorrect ? 'You are on a roll. Ready for the next one?' : 'Nice try. One more round!');
    resetIdleTimer();
  }, 1500);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    setPetState('sleeping', 'I am resting while you think...');
  }, 5000);
}

document.addEventListener('pointermove', () => {
  if (pet.classList.contains('sleeping')) {
    setPetState('idle', 'I am awake again! Ready to help.');
  }
  resetIdleTimer();
});

notes.addEventListener('focus', () => {
  setPetState('idle', 'You can do it! I am here to help.');
  resetIdleTimer();
});

notes.addEventListener('input', () => {
  if (notes.value.trim().length > 0) {
    setPetState('idle', 'I can see you are working. Keep going!');
    resetIdleTimer();
  }
});

function startQuizFlow() {
  currentIndex = 0;
  score = 0;
  isLocked = false;
  updateScore();
  setPetState('loading', 'Generating a quick challenge for you...');
  resetIdleTimer();

  setTimeout(() => {
    renderQuestion();
    setPetState('idle', 'Your study buddy is ready. Pick the best answer!');
    resetIdleTimer();
  }, 1200);
}

generateBtn.addEventListener('click', startQuizFlow);
generateQuizBtn.addEventListener('click', startQuizFlow);

answerOptions.addEventListener('click', (event) => {
  const button = event.target.closest('.answer-button');
  if (!button || isLocked) return;

  isLocked = true;
  revealAnswer(Number(button.dataset.index));
});

setPetState('idle', 'Hello! I am your study buddy.');
updateScore();
renderQuestion();
resetIdleTimer();
