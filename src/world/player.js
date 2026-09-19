import * as THREE from 'three';
import { loadModel } from './loader.js';

const RADIUS = 0.35;
const WALK_SPEED = 3;
const JOG_SPEED = 5;
const GRAVITY = 20;
const STEP_HEIGHT = 0.5; // the floor raycast starts this far above the feet, so small steps are climbed
const TURN_RATE = 12;

const keys = new Set();
window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));

function axis(positive, negative) {
  return (positive.some((code) => keys.has(code)) ? 1 : 0) - (negative.some((code) => keys.has(code)) ? 1 : 0);
}

// The player: a capsule that walks relative to the camera, turns to face where it goes,
// slides along walls and stays on the floor.
export async function createPlayer(scene, { floors, walls }, spawn) {
  const model = await loadModel('player');
  model.position.copy(spawn);
  model.rotation.y = Math.PI;
  scene.add(model);

  const down = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);
  let fallSpeed = 0;

  return {
    model,

    update(dt, yaw) {
      const forward = axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
      const side = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
      if (forward || side) {
        // Camera forward on the ground is (-sin yaw, -cos yaw), camera right is (cos yaw, -sin yaw).
        const x = -Math.sin(yaw) * forward + Math.cos(yaw) * side;
        const z = -Math.cos(yaw) * forward - Math.sin(yaw) * side;
        const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? JOG_SPEED : WALK_SPEED) / Math.hypot(x, z);
        model.position.x += x * speed * dt;
        model.position.z += z * speed * dt;
        pushOutOfWalls(model.position, walls);

        const turn = Math.atan2(x, z) - model.rotation.y;
        model.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, TURN_RATE * dt);
      }

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
