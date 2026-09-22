import { t } from './lib/i18n.js';
import { run, startRun } from './lib/run.js';
import { dressingRoom } from './stages/dressingRoom.js';
import { showRegistration } from './ui/registration.js';
import { showResult } from './ui/result.js';
import { showTimer } from './ui/hud.js';
import { play as playSound, unlockAudio } from './world/audio.js';
import { renderer, render, resize as resizeView } from './world/graphics.js';

// Game flow: registration → dressing room → tunnel → pitch → result → registration for the next player.
// Stage controller: one renderer, one canvas, one loop. The active stage owns its scene and camera,
// and it only updates while the mouse is locked, so Escape pauses the game. A stage moves on with
// go(next stage), which keeps the old one drawing until the next is ready, and calls end() when the
// run is over. A stage may have exit(), called when it stops being shown (it stops its sounds).
const MAX_STEP = 0.05;
const RESULT_DELAY_MS = 2500; // time to read "GOAL!" or "Tackled!" before the result screen

document.body.append(renderer.domElement);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.hidden = document.pointerLockElement === renderer.domElement;
});

let stage = null;

async function go(next) {
  await next.enter(go, end);
  stage?.exit?.();
  stage = next;
  resize();
}

function end() {
  setTimeout(() => {
    document.exitPointerLock();
    stage.exit?.();
    stage = null;
    showResult(() => showRegistration(play));
  }, RESULT_DELAY_MS);
}

// Start is a click (or Enter), so the mouse can be locked straight away.
function play(player) {
  unlockAudio();
  playSound('whistle');
  startRun(player);
  overlay.textContent = t('clickToPlay');
  renderer.domElement.requestPointerLock();
  go(dressingRoom);
}

function resize() {
  resizeView();
  if (!stage) return;
  stage.camera.aspect = window.innerWidth / window.innerHeight;
  stage.camera.updateProjectionMatrix();
}

resize();
window.addEventListener('resize', resize);
showRegistration(play);

let last = 0;
renderer.setAnimationLoop((time) => {
  const seconds = (time - last) / 1000;
  last = time;
  if (!stage) return;
  if (document.pointerLockElement === renderer.domElement) stage.update(Math.min(seconds, MAX_STEP));
  showTimer(run);
  render(stage.scene, stage.camera, seconds);
});
