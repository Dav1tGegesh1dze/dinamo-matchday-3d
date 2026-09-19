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
  floorMesh.position.set(floor.x, -0.1, floor.z);
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

// Turns an ASCII map into a layout for buildLevel: '#' is wall, '.' is floor, and any other
// character marks a named spot on the floor (returned in `spots`). Row 0 is north (−z), column 0 is
// west (−x). Neighbouring wall tiles are merged into as few boxes as possible, to keep draw calls low.
export function layoutFromGrid(rows, tile, wallHeight) {
  const used = rows.map((row) => [...row].map((ch) => ch !== '#'));
  const isFreeWall = (r, c) => r < rows.length && c < rows[r].length && !used[r][c];
  const boxes = [];
  const spots = {};

  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== '#' && ch !== '.') spots[ch] = new THREE.Vector3((c + 0.5) * tile, 0, (r + 0.5) * tile);
      if (!isFreeWall(r, c)) return;
      let w = 1;
      while (isFreeWall(r, c + w)) w++;
      let d = 1;
      while ([...Array(w).keys()].every((i) => isFreeWall(r + d, c + i))) d++;
      for (let dr = 0; dr < d; dr++) for (let dc = 0; dc < w; dc++) used[r + dr][c + dc] = true;
      boxes.push({ x: (c + w / 2) * tile, z: (r + d / 2) * tile, w: w * tile, d: d * tile, h: wallHeight });
    });
  });

  const width = rows[0].length * tile;
  const depth = rows.length * tile;
  return { floor: { x: width / 2, z: depth / 2, w: width, d: depth }, boxes, spots };
}
