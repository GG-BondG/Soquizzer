import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { loadCubismCore, resolveModelUrl } from './live2dAssets.js';
import './Live2DPet.css';

// pixi-live2d-display finds the ticker through window.PIXI.
window.PIXI = PIXI;

const WIDTH = 260;
const HEIGHT = 340;
const FORCE = 3; // MotionPriority.FORCE
const LOOK_SMOOTHING = 0.18;

// Haru's "TapBody" motions carry her own voice lines, so the reaction uses the silent Idle motion instead.
const REACTION_MOTION = { group: 'Idle', index: 1 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateGaze(model, pointerX, pointerY) {
  const coreModel = model?.internalModel?.coreModel;
  if (!coreModel) return;

  const rect = model.canvas?.getBoundingClientRect?.() ?? { width: WIDTH, height: HEIGHT, left: 0, top: 0 };
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clamp((pointerX - centerX) / Math.max(rect.width * 0.6, 1), -1, 1);
  const dy = clamp((pointerY - centerY) / Math.max(rect.height * 0.6, 1), -1, 1);

  const eyeX = dx * 0.9;
  const eyeY = -dy * 0.75;
  const angleX = dx * 25;
  const angleY = -dy * 18;

  const currentEyeX = coreModel.getParameterValueById('ParamEyeBallX');
  const currentEyeY = coreModel.getParameterValueById('ParamEyeBallY');
  const currentAngleX = coreModel.getParameterValueById('ParamAngleX');
  const currentAngleY = coreModel.getParameterValueById('ParamAngleY');

  coreModel.setParameterValueById('ParamEyeBallX', currentEyeX + (eyeX - currentEyeX) * LOOK_SMOOTHING);
  coreModel.setParameterValueById('ParamEyeBallY', currentEyeY + (eyeY - currentEyeY) * LOOK_SMOOTHING);
  coreModel.setParameterValueById('ParamAngleX', currentAngleX + (angleX - currentAngleX) * LOOK_SMOOTHING);
  coreModel.setParameterValueById('ParamAngleY', currentAngleY + (angleY - currentAngleY) * LOOK_SMOOTHING);
}

// The pet's reaction: a motion and a random expression.
function react(model) {
  model.motion(REACTION_MOTION.group, REACTION_MOTION.index, FORCE).catch(() => {});
  model.expression()?.catch?.(() => {});
}

// Plays a voice clip and moves the model's mouth with its loudness. Calls onError if the clip cannot be played
// (for example when it does not exist yet). The AudioContext is created right away so the click that triggered
// this counts as the user gesture browsers require before playing sound.
function playWithLipSync(model, audioUrl, onError) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.connect(context.destination);

  const samples = new Uint8Array(analyser.fftSize);
  const coreModel = model.internalModel.coreModel;
  const moveMouth = () => {
    analyser.getByteTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
    coreModel.setParameterValueById('ParamMouthOpenY', Math.min(1, peak * 3));
  };

  let stopped = false;
  const stop = (failed) => {
    if (stopped) return;
    stopped = true;
    model.internalModel.off('beforeModelUpdate', moveMouth);
    context.close();
    if (failed) onError?.();
  };

  fetch(audioUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data)) // rejects when the "clip" is really an HTML page
    .then((buffer) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      source.onended = () => stop(false);
      model.internalModel.on('beforeModelUpdate', moveMouth);
      source.start();
    })
    .catch(() => stop(true));
}

export default function Live2DPet({ ref, bubble, onTap }) {
  const hostRef = useRef(null);
  const modelRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let app = null;
    let onPointerDown = null;
    let onPointerMove = null;
    const canvas = document.createElement('canvas');
    hostRef.current.appendChild(canvas);

    (async () => {
      try {
        await loadCubismCore();
        // The Cubism 4 runtime needs the Core to exist, so it is imported only now.
        const { Live2DModel } = await import('pixi-live2d-display/cubism4');
        app = new PIXI.Application({
          view: canvas,
          width: WIDTH,
          height: HEIGHT,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });
        const model = await Live2DModel.from(await resolveModelUrl(), { autoInteract: false });
        if (cancelled) {
          model.destroy();
          return;
        }
        model.scale.set(Math.min(WIDTH / model.width, HEIGHT / model.height));
        model.anchor.set(0.5, 1);
        model.position.set(WIDTH / 2, HEIGHT);
        app.stage.addChild(model);
        modelRef.current = model;

        onPointerMove = (event) => {
          updateGaze(model, event.clientX, event.clientY);
        };
        window.addEventListener('pointermove', onPointerMove);

        // Tapping the pet makes it react. The pet sits over the page with pointer-events off so it never blocks
        // what is underneath, so this listens on the window and asks the model whether the tap landed on it.
        onPointerDown = (event) => {
          const box = canvas.getBoundingClientRect();
          if (model.hitTest(event.clientX - box.left, event.clientY - box.top).length > 0) {
            react(model);
            onTap?.();
          }
        };
        window.addEventListener('pointerdown', onPointerDown);
      } catch (error) {
        console.warn('Live2D pet unavailable, showing the text bubble only:', error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (onPointerMove) window.removeEventListener('pointermove', onPointerMove);
      if (onPointerDown) window.removeEventListener('pointerdown', onPointerDown);
      modelRef.current = null;
      app?.destroy(false, { children: true });
      canvas.remove();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    // React with a random expression and a motion, and speak the clip with lip sync. A missing clip is not an error.
    perform(audioUrl) {
      const model = modelRef.current;
      if (!model) return;
      react(model);
      playWithLipSync(model, audioUrl, () => console.debug(`No voice clip at ${audioUrl}, showing the text only`));
    },
  }));

  return (
    <div className="pet-root" aria-live="polite">
      {bubble && (
        <div className="pet-dialog" role="dialog" aria-label="Pet message">
          <div className="pet-dialog-header">
            <span className="pet-dialog-badge">助手</span>
          </div>
          <div className="pet-dialog-body">{bubble}</div>
        </div>
      )}
      <div ref={hostRef} className="pet-canvas" />
      {failed && <div className="pet-fallback" aria-hidden="true">🐱</div>}
    </div>
  );
}
