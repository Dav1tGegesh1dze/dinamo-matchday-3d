import * as THREE from 'three';

export const BALL_RADIUS = 0.11;

const axis = new THREE.Vector3();
const moved = new THREE.Vector3();

// Moves the ball to `position` and spins it as if it rolled there along the ground.
export function rollBall(ball, position) {
  moved.subVectors(position, ball.position).setY(0);
  ball.position.copy(position);
  if (moved.lengthSq() === 0) return;
  ball.rotateOnWorldAxis(axis.set(moved.z, 0, -moved.x).normalize(), moved.length() / BALL_RADIUS);
}
