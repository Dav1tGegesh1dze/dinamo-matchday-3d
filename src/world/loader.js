import * as THREE from 'three';

// Every character model the game shows comes through loadModel(name). Until real .glb files exist,
// each name maps to a blockout placeholder; a real model replaces its entry without changing callers.
const PLACEHOLDERS = {
  player: () => capsule(0xffffff, 0x0b3d91),
};

export async function loadModel(name) {
  return PLACEHOLDERS[name]();
}

// A 1.8 m capsule with a coloured shirt band, standing on its origin, facing +z.
// The badge on the chest shows which way it faces.
function capsule(bodyColor, shirtColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.1, 4, 16),
    new THREE.MeshStandardMaterial({ color: bodyColor }),
  );
  body.position.y = 0.9;
  const shirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.6, 16),
    new THREE.MeshStandardMaterial({ color: shirtColor }),
  );
  shirt.position.y = 1.15;
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  badge.position.set(0, 1.25, 0.37);
  group.add(body, shirt, badge);
  return group;
}
