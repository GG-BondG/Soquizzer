import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="workspace-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">S</span>
        <span>Soquizzer</span>
      </div>
      <button id="generateBtn" class="primary-button" type="button">Generate Quiz</button>
    </header>

    <main class="content-panel">
      <section class="input-panel">
        <h1>Study smarter</h1>
        <p>Upload your notes and let your study buddy help you through the session.</p>

        <div class="input-box">
          <label for="notes">Paste course material</label>
          <textarea id="notes" rows="8" placeholder="Paste chapter notes or textbook excerpt here..."></textarea>
        </div>

        <div class="actions">
          <button id="generateQuizBtn" type="button" class="primary-button">Generate questions</button>
          <button type="button" class="secondary-button">Upload file</button>
        </div>

        <div class="quiz-card" aria-live="polite">
          <div class="quiz-meta">
            <span class="tag">Quick check</span>
            <span id="scoreValue">Score: 0</span>
          </div>
          <h2 id="questionText">Your study buddy is ready.</h2>
          <div id="answerOptions" class="answer-options"></div>
        </div>
      </section>
    </main>

    <div id="pet" class="pet idle" aria-live="polite" aria-label="Study pet">
      <div class="pet-body">
        <div class="pet-face">
          <span class="eye left"></span>
          <span class="eye right"></span>
          <span class="mouth"></span>
        </div>
      </div>
      <div class="pet-bubble">Hello! I am your study buddy.</div>
    </div>
  </div>
`

const pet = document.querySelector('#pet')
const petBubble = pet.querySelector('.pet-bubble')
const generateBtn = document.querySelector('#generateBtn')
const generateQuizBtn = document.querySelector('#generateQuizBtn')
const notes = document.querySelector('#notes')
const questionText = document.querySelector('#questionText')
const answerOptions = document.querySelector('#answerOptions')
const scoreValue = document.querySelector('#scoreValue')

const states = {
  idle: '🙂',
  loading: '🤔',
  success: '😄',
  error: '😵',
  sleeping: '💤',
}

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
]

let currentIndex = 0
let score = 0
let isLocked = false
let idleTimer = null

function setPetState(state, message) {
  pet.className = `pet ${state}`
  petBubble.textContent = message

  const face = pet.querySelector('.pet-face')
  face.innerHTML = `
    <span class="eye left"></span>
    <span class="eye right"></span>
    <span class="mouth"></span>
  `

  const body = pet.querySelector('.pet-body')
  body.style.setProperty('--pet-face', states[state] || states.idle)
}

function updateScore() {
  scoreValue.textContent = `Score: ${score}`
}

function renderQuestion() {
  const currentQuestion = quizBank[currentIndex]
  if (!currentQuestion) return

  questionText.textContent = currentQuestion.question
  answerOptions.innerHTML = currentQuestion.options
    .map(
      (option, index) => `
        <button type="button" class="answer-button" data-index="${index}">${index + 1}. ${option}</button>
      `,
    )
    .join('')
}

function revealAnswer(selectedIndex) {
  const currentQuestion = quizBank[currentIndex]
  const buttons = [...answerOptions.querySelectorAll('.answer-button')]

  buttons.forEach((button, index) => {
    button.disabled = true
    if (index === currentQuestion.answer) {
      button.classList.add('correct')
    }
    if (index === selectedIndex && index !== currentQuestion.answer) {
      button.classList.add('wrong')
    }
  })

  const isCorrect = selectedIndex === currentQuestion.answer

  if (isCorrect) {
    score += 1
    updateScore()
    setPetState('success', `Correct! ${currentQuestion.insight}`)
  } else {
    setPetState('error', `Not quite. The right answer is: ${currentQuestion.options[currentQuestion.answer]}. Keep going!`)
  }

  setTimeout(() => {
    currentIndex = (currentIndex + 1) % quizBank.length
    renderQuestion()
    isLocked = false
    setPetState('idle', isCorrect ? 'You are on a roll. Ready for the next one?' : 'Nice try. One more round!')
    resetIdleTimer()
  }, 1500)
}

function resetIdleTimer() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    setPetState('sleeping', 'I am resting while you think...')
  }, 5000)
}

document.addEventListener('pointermove', () => {
  if (pet.classList.contains('sleeping')) {
    setPetState('idle', 'I am awake again! Ready to help.')
  }
  resetIdleTimer()
})

notes.addEventListener('focus', () => {
  setPetState('idle', 'You can do it! I am here to help.')
  resetIdleTimer()
})

notes.addEventListener('input', () => {
  if (notes.value.trim().length > 0) {
    setPetState('idle', 'I can see you are working. Keep going!')
    resetIdleTimer()
  }
})

function startQuizFlow() {
  currentIndex = 0
  score = 0
  isLocked = false
  updateScore()
  setPetState('loading', 'Generating a quick challenge for you...')
  resetIdleTimer()

  setTimeout(() => {
    renderQuestion()
    setPetState('idle', 'Your study buddy is ready. Pick the best answer!')
    resetIdleTimer()
  }, 1200)
}

generateBtn.addEventListener('click', startQuizFlow)
generateQuizBtn.addEventListener('click', startQuizFlow)

answerOptions.addEventListener('click', (event) => {
  const button = event.target.closest('.answer-button')
  if (!button || isLocked) return

  isLocked = true
  revealAnswer(Number(button.dataset.index))
})

setPetState('idle', 'Hello! I am your study buddy.')
updateScore()
renderQuestion()
resetIdleTimer()
