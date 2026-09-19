import * as THREE from 'three';

const DISTANCE = 3.5; // behind the player
const SHOULDER = 0.5; // to the right of the player
const HEAD_HEIGHT = 1.6;
const MIN_PITCH = THREE.MathUtils.degToRad(-30);
const MAX_PITCH = THREE.MathUtils.degToRad(60);
const START_PITCH = THREE.MathUtils.degToRad(15);
const SENSITIVITY = 0.0025; // radians per pixel of mouse movement, tunable at the stand
const WALL_GAP = 0.2; // how far the camera stays in front of a wall
const MIN_HEIGHT = 0.3; // above the feet, so looking up never puts the camera under the floor
const FOLLOW_RATE = 15;
const EASE_OUT_RATE = 5;
const DRIFT_RATE = 1.2; // how fast driftBehind swings the camera round
const HIDE_DISTANCE = 0.9; // closer than this, the player model is hidden so it doesn't fill the view

// The mouse turns whichever follow camera was created last (each run creates new ones).
let current = null;
document.addEventListener('mousemove', (event) => {
  if (!document.pointerLockElement || !current) return;
  current.yaw -= event.movementX * SENSITIVITY;
  current.pitch = THREE.MathUtils.clamp(current.pitch + event.movementY * SENSITIVITY, MIN_PITCH, MAX_PITCH);
});

// Third-person follow camera. The mouse orbits it around the player (yaw around, pitch up and down).
// Raycasts against the wall boxes pull it in front of any wall between the player's head and where
// it wants to be; it eases back out when the space opens up.
export function createFollowCamera({ walls }, subject) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  const head = new THREE.Vector3();
  const target = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const right = new THREE.Vector3();
  const back = new THREE.Vector3();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  let distance = DISTANCE;
  let placed = false;

  const rig = {
    camera,
    yaw: 0,
    pitch: START_PITCH,

    // For scripted scenes: swings the camera back behind the subject a little each frame, so it
    // follows the action when the mouse is left alone.
    driftBehind(dt) {
      const behind = subject.rotation.y + Math.PI - rig.yaw;
      rig.yaw += Math.atan2(Math.sin(behind), Math.cos(behind)) * Math.min(1, DRIFT_RATE * dt);
    },

    update(dt) {
      const feet = subject.position;
      target.set(feet.x, feet.y + HEAD_HEIGHT, feet.z);
      if (placed) head.lerp(target, 1 - Math.exp(-FOLLOW_RATE * dt));
      else head.copy(target);
      placed = true;

      right.set(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw));
      aim.copy(head).addScaledVector(right, clearance(head, right, SHOULDER));

      back.set(
        Math.sin(rig.yaw) * Math.cos(rig.pitch),
        Math.sin(rig.pitch),
        Math.cos(rig.yaw) * Math.cos(rig.pitch),
      );
      const allowed = clearance(aim, back, DISTANCE);
      distance = allowed < distance ? allowed : distance + (allowed - distance) * (1 - Math.exp(-EASE_OUT_RATE * dt));

      camera.position.copy(aim).addScaledVector(back, distance);
      camera.position.y = Math.max(camera.position.y, feet.y + MIN_HEIGHT);
      camera.lookAt(aim);
      subject.visible = distance > HIDE_DISTANCE;
    },
  };

  // How far from `origin` along `direction` the camera may go, up to `max`, before a wall.
  function clearance(origin, direction, max) {
    ray.set(origin, direction);
    let free = max;
    for (const box of walls) {
      if (ray.intersectBox(box, hit)) free = Math.min(free, origin.distanceTo(hit) - WALL_GAP);
    }
    return Math.max(free, 0);
  }

  current = rig;
  return rig;
}
