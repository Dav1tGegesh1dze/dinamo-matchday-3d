import * as THREE from 'three';
import { t } from './lib/i18n.js';
import { run, startRun } from './lib/run.js';
import { dressingRoom } from './stages/dressingRoom.js';
import { showRegistration } from './ui/registration.js';
import { showResult } from './ui/result.js';
import { showTimer } from './ui/hud.js';

// Game flow: registration → dressing room → tunnel → pitch → result → play again or registration.
// Stage controller: one renderer, one canvas, one loop. The active stage owns its scene and camera,
// and it only updates while the mouse is locked, so Escape pauses the game. A stage moves on with
// go(next stage), which keeps the old one drawing until the next is ready, and calls end() when the
// run is over.
const MAX_STEP = 0.05;
const RESULT_DELAY_MS = 2500; // time to read "GOAL!" or "Tackled!" before the result screen

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.append(renderer.domElement);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.hidden = document.pointerLockElement === renderer.domElement;
});

let stage = null;

async function go(next) {
  await next.enter(go, end);
  stage = next;
  resize();
}

function end() {
  setTimeout(() => {
    document.exitPointerLock();
    stage = null;
    showResult(() => play(run), () => showRegistration(play));
  }, RESULT_DELAY_MS);
}

// Start and Play again are clicks (or Enter), so the mouse can be locked straight away.
function play(player) {
  startRun(player);
  overlay.textContent = t('clickToPlay');
  renderer.domElement.requestPointerLock();
  go(dressingRoom);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!stage) return;
  stage.camera.aspect = window.innerWidth / window.innerHeight;
  stage.camera.updateProjectionMatrix();
}

resize();
window.addEventListener('resize', resize);
showRegistration(play);

let last = 0;
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - last) / 1000, MAX_STEP);
  last = time;
  if (!stage) return;
  if (document.pointerLockElement === renderer.domElement) stage.update(dt);
  showTimer(run);
  renderer.render(stage.scene, stage.camera);
});
