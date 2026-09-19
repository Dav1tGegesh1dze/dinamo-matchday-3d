import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The Boris Paichadze Dinamo Arena, built from its real proportions (see docs/SPEC.md §10): an oval
// two-tier bowl with a walkway ring between the tiers, a ring roof over the upper tier carried by
// 58 pylons, and a 105 × 68 m pitch. The pitch's long axis is x; the main stand, with the players'
// tunnel on the halfway line, is on the +z side. Every surface takes its look from a texture file.

const SEGMENTS = 256;
const PITCH = { length: 105, width: 68 };
const FRONT = { a: 76, b: 54 }; // the ellipse of the first row, clear of the pitch corners
const TUNNEL = { width: 4, height: 3, depth: 12 };
const PYLONS = 58;
const FLOODLIGHTS = 120;
const GRASS_TILE = 4; // metres covered by one repeat of the grass texture
const SEAT_TILE = { along: 8, up: 6.4 }; // one seats.png tile is 16 seats × 8 rows
const BOARD = { height: 0.9, length: 14.4, gap: 4 }; // boards.png is 16:1; a gap in front of the tunnel

const textures = new THREE.TextureLoader();

function texture(name, anisotropy = 8) {
  const map = textures.load(`assets/textures/${name}`);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  return map;
}

export function buildStadium(scene) {
  const grass = texture('grass.jpg');
  const seats = new THREE.MeshStandardMaterial({ map: texture('seats.png', 16), side: THREE.DoubleSide });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b5ad, side: THREE.DoubleSide });
  const roof = new THREE.MeshStandardMaterial({ color: 0xdadcdf, side: THREE.DoubleSide });

  scene.background = new THREE.Color(0x9cc4e8);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a5a3a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(-60, 120, 80);
  scene.add(sun);

  scene.add(pitch(grass), markings());

  // The bowl, from the front wall up to the roof. [a, b, y] is an ellipse at a height.
  const lowTop = [104, 82, 13];
  const upBottom = [107, 85, 14.5];
  const upTop = [135, 113, 32];
  scene.add(
    ring([FRONT.a, FRONT.b, 0], [FRONT.a, FRONT.b, TUNNEL.height], concrete, [1, 1], aroundTunnel()),
    ring([FRONT.a, FRONT.b, TUNNEL.height], lowTop, seats, seatRepeat([FRONT.a, FRONT.b, TUNNEL.height], lowTop)),
    ring(lowTop, [107, 85, 13], concrete), // the walkway ring between the tiers
    ring([107, 85, 13], upBottom, concrete),
    ring(upBottom, upTop, seats, seatRepeat(upBottom, upTop)),
    ring(upTop, [135, 113, 34], concrete),
    ring([110, 88, 36], [110, 88, 37], roof), // roof fascia
    ring([110, 88, 37], [137, 115, 38.5], roof),
    floodlights([110, 88, 36.2]),
    pylons([139, 117], 40, concrete),
    boards(),
  );
  return { walls: tunnel(scene, concrete) };
}

// The pitch in 14 mown stripes on the apron that fills the bowl, both in the same grass texture.
function pitch(grass) {
  const apron = new THREE.CircleGeometry(1, SEGMENTS).rotateX(-Math.PI / 2).scale(FRONT.a, 1, FRONT.b).toNonIndexed();
  const field = new THREE.PlaneGeometry(PITCH.length, PITCH.width, 14, 1).rotateX(-Math.PI / 2).translate(0, 0.01, 0).toNonIndexed();
  paint(apron, () => 0.72);
  paint(field, (x) => (Math.floor((x + PITCH.length / 2) / (PITCH.length / 14)) % 2 ? 0.86 : 1));
  const geometry = mergeGeometries([apron, field]);
  worldUvs(geometry, GRASS_TILE);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true }));
}

// Colours each triangle by `shade(x of its centre)`, for the mowing stripes.
function paint(geometry, shade) {
  const position = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < position.count; i += 3) {
    const value = shade((position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3);
    for (let k = 0; k < 3; k++) colors.push(value, value, value);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function worldUvs(geometry, tile) {
  const position = geometry.attributes.position;
  const uvs = [];
  for (let i = 0; i < position.count; i++) uvs.push(position.getX(i) / tile, position.getZ(i) / tile);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}

// Regulation markings: touchlines, goal lines, halfway line, centre circle, penalty and goal areas,
// penalty spots and arcs. 12 cm wide, merged into one mesh.
function markings() {
  const L = PITCH.length / 2;
  const W = PITCH.width / 2;
  const line = (x0, z0, x1, z1) => {
    const length = Math.hypot(x1 - x0, z1 - z0) + 0.12;
    const geometry = new THREE.PlaneGeometry(length, 0.12).rotateX(-Math.PI / 2);
    geometry.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    return geometry.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  };
  const arc = (x, z, radius, start, length) =>
    new THREE.RingGeometry(radius - 0.06, radius + 0.06, 64, 1, start, length).rotateX(-Math.PI / 2).translate(x, 0, z);
  const spot = (x) => new THREE.CircleGeometry(0.15, 16).rotateX(-Math.PI / 2).translate(x, 0, 0);

  const parts = [line(-L, -W, L, -W), line(-L, W, L, W), line(0, -W, 0, W), arc(0, 0, 9.15, 0, Math.PI * 2), spot(0)];
  for (const side of [-1, 1]) {
    const goal = side * L;
    parts.push(line(goal, -W, goal, W));
    for (const [depth, half] of [[16.5, 20.16], [5.5, 9.16]]) {
      const inner = goal - side * depth;
      parts.push(line(goal, -half, inner, -half), line(goal, half, inner, half), line(inner, -half, inner, half));
    }
    const penaltySpot = goal - side * 11;
    const reach = Math.acos(5.5 / 9.15); // the arc shows only outside the penalty area
    parts.push(spot(penaltySpot), arc(penaltySpot, 0, 9.15, (side > 0 ? Math.PI : 0) - reach, reach * 2));
  }
  const geometry = mergeGeometries(parts.map((part) => part.toNonIndexed()));
  geometry.translate(0, 0.02, 0);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }));
}

// A band between two ellipses [a, b, y]; both the same ellipse makes a vertical wall. [from, to]
// is the angle range it covers (the whole way round by default).
function ring([a0, b0, y0], [a1, b1, y1], material, [u, v] = [1, 1], [from, to] = [0, Math.PI * 2]) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = from + (i / SEGMENTS) * (to - from);
    positions.push(a0 * Math.cos(t), y0, b0 * Math.sin(t), a1 * Math.cos(t), y1, b1 * Math.sin(t));
    uvs.push((i / SEGMENTS) * u, 0, (i / SEGMENTS) * u, v);
    if (i < SEGMENTS) indices.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

// The angle range of the front wall that leaves exactly the tunnel mouth open (+z, on the halfway line).
function aroundTunnel() {
  const edge = Math.acos(TUNNEL.width / 2 / FRONT.a);
  return [Math.PI - edge, edge + Math.PI * 2];
}

// How many seats.png tiles fit around and up a tier, so every seat is the same real size.
function seatRepeat([a0, b0, y0], [a1, b1, y1]) {
  const a = (a0 + a1) / 2;
  const b = (b0 + b1) / 2;
  const around = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2);
  const up = Math.hypot(a1 - a0, y1 - y0);
  return [Math.round(around / SEAT_TILE.along), up / SEAT_TILE.up];
}

function floodlights([a, b, y]) {
  const lamps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.6, 0.7, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xfffbe8 }),
    FLOODLIGHTS,
  );
  const lamp = new THREE.Object3D();
  for (let i = 0; i < FLOODLIGHTS; i++) {
    const t = (i / FLOODLIGHTS) * Math.PI * 2;
    lamp.position.set(a * Math.cos(t), y, b * Math.sin(t));
    lamp.lookAt(0, 0, 0);
    lamp.updateMatrix();
    lamps.setMatrixAt(i, lamp.matrix);
  }
  return lamps;
}

function pylons([a, b], height, material) {
  const columns = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, height, 2.2), material, PYLONS);
  const column = new THREE.Object3D();
  for (let i = 0; i < PYLONS; i++) {
    const t = (i / PYLONS) * Math.PI * 2;
    column.position.set(a * Math.cos(t), height / 2, b * Math.sin(t));
    column.rotation.y = -Math.atan2(b * Math.sin(t), a * Math.cos(t));
    column.updateMatrix();
    columns.setMatrixAt(i, column.matrix);
  }
  return columns;
}

// Advertising boards 4 m outside the touchlines and goal lines, text facing the pitch.
function boards() {
  const L = PITCH.length / 2 + 4;
  const W = PITCH.width / 2 + 4;
  const runs = [
    [-L, -W, L, -W],
    [L, W, BOARD.gap, W],
    [-BOARD.gap, W, -L, W],
    [L, -W + 6, L, W - 6],
    [-L, W - 6, -L, -W + 6],
  ];
  const geometry = mergeGeometries(
    runs.map(([x0, z0, x1, z1]) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const run = new THREE.PlaneGeometry(length, BOARD.height);
      const uv = run.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (length / BOARD.length));
      run.rotateY(-Math.atan2(z1 - z0, x1 - x0)); // each run has the pitch on its left, so it faces the pitch
      return run.translate((x0 + x1) / 2, BOARD.height / 2, (z0 + z1) / 2);
    }),
  );
  const faces = new THREE.Group();
  faces.add(
    new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture('boards.png') })),
    new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x1b1d22, side: THREE.BackSide })),
  );
  return faces;
}

// The players' tunnel under the main stand, opening onto the pitch on the halfway line. Returns
// its walls and ceiling as boxes, so the follow camera stays inside it.
function tunnel(scene, material) {
  const { width, height, depth } = TUNNEL;
  const z = FRONT.b + depth / 2;
  const boxes = [
    [-width / 2 - 0.25, height / 2, z, 0.5, height, depth],
    [width / 2 + 0.25, height / 2, z, 0.5, height, depth],
    [0, height + 0.25, z, width + 1, 0.5, depth],
    [0, height / 2, FRONT.b + depth + 0.25, width + 1, height, 0.5],
  ];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  floor.position.set(0, 0.005, z);
  scene.add(floor);
  return boxes.map(([x, y, bz, w, h, d]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, bz);
    scene.add(mesh);
    return new THREE.Box3().setFromObject(mesh);
  });
}
