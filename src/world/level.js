import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadTexture } from './loader.js';

// A textured surface: the material, and how many metres one repeat of its texture covers.
export function surface(textureName, tile) {
  return { material: new THREE.MeshStandardMaterial({ map: loadTexture(textureName) }), tile };
}

// Builds a stage's lights, floor, walls and ceiling. `look` gives the surfaces: { floor, wall,
// ceiling }, plus `zones` — areas [x0, z0, x1, z1] with their own floor, and wall panels on every
// wall face inside the area (the showers' tiles). Walls are merged into one mesh. Returns what the
// player stands on (floors), what the player and camera collide with (walls, as axis-aligned boxes)
// and the ceiling height.
export function buildLevel(scene, { floor, boxes }, look) {
  scene.background = new THREE.Color(0x1d2230);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6f7a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.2);
  sun.position.set(4, 10, 6);
  scene.add(sun);

  const whole = [floor.x - floor.w / 2, floor.z - floor.d / 2, floor.x + floor.w / 2, floor.z + floor.d / 2];
  const floorMesh = plane(whole, 0, look.floor, true);
  scene.add(floorMesh);
  for (const zone of look.zones) scene.add(plane(zone.area, 0.005, zone.floor, true));
  const height = Math.max(...boxes.map((box) => box.h));
  scene.add(plane(whole, height, look.ceiling, false));

  scene.add(solid(boxes.map(({ x, z, w, d, h }) => new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z)), look.wall));
  const walls = boxes.map(({ x, z, w, d, h }) => new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
  for (const zone of look.zones) scene.add(solid(cladding(walls, zone.area), zone.wall));

  return { floors: [floorMesh], walls, ceiling: height };
}

// Panels 5 mm in front of every wall face (or part of one) that lies inside `area`.
function cladding(walls, [x0, z0, x1, z1]) {
  const panels = [];
  const clip = (from, to, low, high) => [Math.max(from, low), Math.min(to, high)];
  for (const { min, max } of walls) {
    const h = max.y;
    for (const [x, turn] of [[min.x, -Math.PI / 2], [max.x, Math.PI / 2]]) {
      const [a, b] = clip(min.z, max.z, z0, z1);
      if (x < x0 || x > x1 || b <= a) continue;
      panels.push(new THREE.PlaneGeometry(b - a, h).rotateY(turn).translate(x + Math.sign(turn) * 0.005, h / 2, (a + b) / 2));
    }
    for (const [z, turn] of [[min.z, Math.PI], [max.z, 0]]) {
      const [a, b] = clip(min.x, max.x, x0, x1);
      if (z < z0 || z > z1 || b <= a) continue;
      panels.push(new THREE.PlaneGeometry(b - a, h).rotateY(turn).translate((a + b) / 2, h / 2, z + (turn ? -0.005 : 0.005)));
    }
  }
  return panels;
}

// Merges box geometries (already in place) into one mesh with a surface mapped by real size.
export function solid(geometries, { material, tile }) {
  const geometry = mergeGeometries(geometries);
  worldUvs(geometry, tile);
  return new THREE.Mesh(geometry, material);
}

// A horizontal rectangle [x0, z0, x1, z1] at height y, facing up (a floor) or down (a ceiling).
function plane([x0, z0, x1, z1], y, { material, tile }, facingUp) {
  const geometry = new THREE.PlaneGeometry(x1 - x0, z1 - z0)
    .rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2)
    .translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  worldUvs(geometry, tile);
  return new THREE.Mesh(geometry, material);
}

// Texture coordinates from world position in metres, so a texture keeps its real size on any
// surface: floors and ceilings use x and z, walls their length and the height, running to the
// viewer's right on every wall so text on them is never mirrored.
export function worldUvs(geometry, tile) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uvs = [];
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const [nx, ny, nz] = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    if (Math.abs(ny) > 0.5) uvs.push(x / tile, z / tile);
    else if (Math.abs(nx) > 0.5) uvs.push((nx > 0 ? -z : z) / tile, y / tile);
    else uvs.push((nz > 0 ? x : -x) / tile, y / tile);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
