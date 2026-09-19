import './style.css'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

window.PIXI = PIXI

const appRoot = document.querySelector('#app')
appRoot.innerHTML = `
  <div class="scene-shell">
    <div class="page-glow"></div>

    <aside class="study-panel">
      <div class="pet-status">
        <span class="status-dot"></span>
        Study Pet Online
      </div>

      <h1>Soquizzer</h1>
      <p class="eyebrow">Personal learning companion</p>

      <div class="summary-card">
        <span class="label">Today's focus</span>
        <strong>Review chapters 4–6</strong>
        <p>5 quiz cards · 2 review rounds · 89% retention</p>
      </div>

      <div class="actions-row">
        <button class="primary-btn" type="button">Start quiz</button>
        <button class="ghost-btn" type="button">Open notes</button>
      </div>

      <ul class="mini-stats">
        <li><span>Streak</span><strong>12 days</strong></li>
        <li><span>Accuracy</span><strong>91%</strong></li>
        <li><span>Focus</span><strong>High</strong></li>
      </ul>
    </aside>

    <main class="workspace-card">
      <header class="workspace-header">
        <div>
          <span class="chip">Live study board</span>
        </div>
        <button type="button" class="ghost-btn small">Sync</button>
      </header>

      <div class="lesson-box">
        <h2>Current task</h2>
        <p>Extract the key ideas from the textbook chunk, review the answer, and let the pet react to your progress.</p>
      </div>

      <div class="lesson-grid">
        <div class="mini-box">
          <span>Textbook chunks</span>
          <strong>18</strong>
        </div>
        <div class="mini-box">
          <span>Active recall</span>
          <strong>7</strong>
        </div>
        <div class="mini-box">
          <span>Review status</span>
          <strong>On track</strong>
        </div>
      </div>
    </main>

    <div id="pet-stage" aria-label="Live2D study pet"></div>
  </div>
`

const stage = document.querySelector('#pet-stage')
const app = new PIXI.Application({
  antialias: true,
  transparent: true,
  resizeTo: stage,
})

stage.appendChild(app.view)

const modelUrl = 'https://fastly.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json'
const PET_EXPRESSIONS = {
  idle: 'f00',
  correct: 'f02',
  wrong: 'f04',
}

const setPetExpression = (model, expressionName) => {
  const expressionId = PET_EXPRESSIONS[expressionName] ?? PET_EXPRESSIONS.idle
  model.expression(expressionId).catch((error) => {
    console.error('Failed to update pet expression:', error)
  })
}

const resetPetExpression = (model) => {
  setTimeout(() => setPetExpression(model, 'idle'), 1000)
}

const attachRealAppInteractions = (model) => {
  const startQuizButton = document.querySelector('.primary-btn')
  const notesButton = document.querySelector('.ghost-btn')
  const syncButton = document.querySelector('.workspace-header .ghost-btn')
  const interactiveCards = document.querySelectorAll('.mini-box, .summary-card, .lesson-box')

  startQuizButton?.addEventListener('click', () => {
    model.motion('Tap')
    setPetExpression(model, 'correct')
    resetPetExpression(model)
  })

  notesButton?.addEventListener('click', () => {
    setPetExpression(model, 'idle')
  })

  syncButton?.addEventListener('click', () => {
    model.motion('Tap')
    setPetExpression(model, 'correct')
    resetPetExpression(model)
  })

  interactiveCards.forEach((card) => {
    card.addEventListener('pointerdown', () => {
      model.motion('Tap')
      setPetExpression(model, 'correct')
      resetPetExpression(model)
    })
  })
}

if (!window.Live2DCubismCore) {
  stage.innerHTML = '<div class="model-fallback">Live2D runtime is not loaded. Please refresh the page.</div>'
  console.error('Live2D Cubism Core is missing.')
} else {
  try {
    const model = await Live2DModel.from(modelUrl)

    model.anchor.set(0.5)
    model.position.set(app.screen.width * 0.76, app.screen.height * 0.82)
    model.scale.set(0.16)
    model.interactive = true
    model.buttonMode = true

    model.on('hit', (hitAreas) => {
      if (hitAreas.includes('body')) {
        model.motion('Tap')
        setPetExpression(model, 'correct')
        resetPetExpression(model)
      }
    })

    attachRealAppInteractions(model)

    setPetExpression(model, 'idle')
    app.stage.addChild(model)

    window.addEventListener('resize', () => {
      model.position.set(app.screen.width * 0.76, app.screen.height * 0.82)
    })
  } catch (error) {
    console.error('Failed to load Live2D model:', error)
    stage.innerHTML = '<div class="model-fallback">Live2D model failed to load.</div>'
  }
}

