import { t } from './lib/i18n.js';
import { run, startRun } from './lib/run.js';
import { dressingRoom } from './stages/dressingRoom.js';
import { showRegistration } from './ui/registration.js';
import { showResult } from './ui/result.js';
import { showTimer } from './ui/hud.js';
import { play as playSound, unlockAudio } from './world/audio.js';
import { renderer, render, prepare, release, resize as resizeView } from './world/graphics.js';

// Game flow: registration → dressing room → tunnel → pitch → result → registration for the next player.
// Stage controller: one renderer, one canvas, one loop. The active stage owns its scene and camera,
// and it only updates while the mouse is locked, so Escape pauses the game. A stage moves on with
// go(next stage), which keeps the old one drawing until the next is ready, and calls end() when the
// run is over. A stage may have exit(), called when it stops being shown (it stops its sounds). A
// new stage is prepared before it is shown (see prepare), so playing it never stutters. When a run
// ends, its scenes are released from the graphics card.
const MAX_STEP = 0.05;
const RESULT_DELAY_MS = 2500; // time to read "GOAL!" or "Tackled!" before the result screen

document.body.append(renderer.domElement);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.hidden = document.pointerLockElement === renderer.domElement;
});

let stage = null;
const scenes = new Set(); // the current run's scenes

async function go(next) {
  await next.enter(go, end);
  fit(next.camera);
  await prepare(next.scene, next.camera);
  stage?.exit?.();
  stage = next;
  scenes.add(next.scene);
}

function end() {
  setTimeout(() => {
    document.exitPointerLock();
    stage.exit?.();
    stage = null;
    scenes.forEach(release);
    scenes.clear();
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
  if (stage) fit(stage.camera);
}

function fit(camera) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
