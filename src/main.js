import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="workspace-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">S</span>
        <span>Soquizzer</span>
      </div>
      <button class="primary-button" type="button">Generate Quiz</button>
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
          <button id="generateBtn" type="button" class="primary-button">Generate questions</button>
          <button type="button" class="secondary-button">Upload file</button>
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
const notes = document.querySelector('#notes')

const states = {
  idle: '🙂',
  loading: '🤔',
  success: '😄',
  error: '😵',
  sleeping: '💤',
}

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

let idleTimer = null

function resetIdleTimer() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    setPetState('sleeping', 'I am resting while you think...')
  }, 5000)
}

document.addEventListener('pointermove', () => {
  if (pet.classList.contains('sleeping')) {
    setPetState('idle', 'I am awake again!')
  }
  resetIdleTimer()
})

notes.addEventListener('focus', () => {
  setPetState('idle', 'You can do it! I am here to help.')
  resetIdleTimer()
})

generateBtn.addEventListener('click', () => {
  setPetState('loading', 'Generating questions for you...')
  resetIdleTimer()

  setTimeout(() => {
    setPetState('success', 'Done! Your quiz is ready.')
    resetIdleTimer()
  }, 1800)
})

setPetState('idle', 'Hello! I am your study buddy.')
resetIdleTimer()
