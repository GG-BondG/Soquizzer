import './style.css'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

window.PIXI = PIXI

const appRoot = document.querySelector('#app')
appRoot.innerHTML = `
  <div class="scene-shell">
    <div class="pet-panel">
      <div class="pet-status">
        <span class="status-dot"></span>
        Study Pet Online
      </div>
      <h1>Soquizzer</h1>
      <p>Live2D companion ready to react to your study flow.</p>
    </div>
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
        model.motion('tap_body')
      }
    })

    app.stage.addChild(model)

    window.addEventListener('resize', () => {
      model.position.set(app.screen.width * 0.76, app.screen.height * 0.82)
    })
  } catch (error) {
    console.error('Failed to load Live2D model:', error)
    stage.innerHTML = '<div class="model-fallback">Live2D model failed to load.</div>'
  }
}

