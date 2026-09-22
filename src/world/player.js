import * as THREE from 'three';
import { createCharacter, turnTowards, KITS } from './character.js';
import { play } from './audio.js';

const RADIUS = 0.35;
const JOG_SPEED = 3;
const SPRINT_SPEED = 5;
const GRAVITY = 20;
const TURN_RATE = 12;
const STRIDE = 1.5; // metres per footstep at a jog (the Run clip covers 3 m per cycle, two steps)
const STEP_VOLUME = 0.4;
const STEP_HEIGHT = 0.5; // the floor raycast starts this far above the feet, so small steps are climbed

const keys = new Set();
window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));

function axis(positive, negative) {
  return (positive.some((code) => keys.has(code)) ? 1 : 0) - (negative.some((code) => keys.has(code)) ? 1 : 0);
}

// The player: a footballer, in training clothes until he picks up his kit, who jogs relative to the camera, turns to face where
// he goes, slides along walls (as a capsule) and stays on the floor.
export async function createPlayer(scene, { floors, walls }, spawn) {
  const character = await createCharacter(KITS.training);
  const model = character.object;
  model.position.copy(spawn);
  model.rotation.y = Math.PI;
  scene.add(model);
  character.moveAt(0);
  character.update(0);

  const down = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);
  let fallSpeed = 0;
  let sinceStep = 0;

  return {
    model,
    wear: character.wear,

    update(dt, yaw) {
      const forward = axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
      const side = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (forward || side) {
        // Camera forward on the ground is (-sin yaw, -cos yaw), camera right is (cos yaw, -sin yaw).
        const x = -Math.sin(yaw) * forward + Math.cos(yaw) * side;
        const z = -Math.cos(yaw) * forward - Math.sin(yaw) * side;
        const speed = sprinting ? SPRINT_SPEED : JOG_SPEED;
        model.position.x += (x / Math.hypot(x, z)) * speed * dt;
        model.position.z += (z / Math.hypot(x, z)) * speed * dt;
        pushOutOfWalls(model.position, walls);

        turnTowards(model, x, z, TURN_RATE * dt);
        character.moveAt(speed);
        sinceStep += speed * dt;
        if (sinceStep >= STRIDE) {
          sinceStep -= STRIDE;
          play('step', STEP_VOLUME);
        }
      } else {
        character.moveAt(0);
      }
      character.update(dt);

      fallSpeed += GRAVITY * dt;
      model.position.y -= fallSpeed * dt;
      down.set(rayOrigin.copy(model.position).setY(model.position.y + STEP_HEIGHT), rayDirection);
      const ground = down.intersectObjects(floors)[0];
      if (ground && model.position.y <= ground.point.y) {
        model.position.y = ground.point.y;
        fallSpeed = 0;
      }
    },
  };
}

// Pushes the capsule's footprint (a circle) out of every wall box it overlaps, along the shortest
// way out, so walking into a wall at an angle slides along it.
function pushOutOfWalls(position, walls) {
  for (const box of walls) {
    const dx = position.x - THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
    const dz = position.z - THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
    const distance = Math.hypot(dx, dz);
    if (distance > 0 && distance < RADIUS) {
      position.x += (dx / distance) * (RADIUS - distance);
      position.z += (dz / distance) * (RADIUS - distance);
    }
  }
}
