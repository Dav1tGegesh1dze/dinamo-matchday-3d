import * as THREE from 'three';

const FLOOR_COLOR = 0x5c5f66;
const BOX_COLOR = 0x9a9ca3;

// Builds a stage's lights, floor and blockout boxes. Returns what the player stands on (floors)
// and what the player and camera collide with (walls, as axis-aligned boxes).
export function buildLevel(scene, { floor, boxes }) {
  scene.background = new THREE.Color(0x1d2230);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(4, 10, 6);
  scene.add(sun);

  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(floor.w, 0.2, floor.d),
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR }),
  );
  floorMesh.position.y = -0.1;
  scene.add(floorMesh);

  const material = new THREE.MeshStandardMaterial({ color: BOX_COLOR });
  const walls = boxes.map(({ x, z, w, d, h }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    return new THREE.Box3().setFromObject(mesh);
  });

  return { floors: [floorMesh], walls };
}
