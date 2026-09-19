import * as THREE from 'three';
import { solid } from './level.js';

// Built-in fixtures made of textured boxes, like the walls: lockers with their bench, a free-standing
// bench, a treatment bed, shower heads and hanging room signs. Each returns { object, boxes }: what
// to add to the scene, and the boxes the player and camera collide with.

const LOCKER = { width: 1.05, depth: 0.55, height: 2.2, panel: 0.04, shelf: 1.85 };
const SEAT = { depth: 0.42, height: 0.45 };
const METAL = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.35 });
const PADDING = new THREE.MeshStandardMaterial({ color: 0x21406f, roughness: 0.6 });

// A row of wooden lockers against a wall, each with a shelf, and a bench seat in front of the row.
// The wall runs along `axis` ('x' or 'z') at `at`, from `from` to `to`; `inward` (+1 or −1) points
// into the room. Also returns `hooks`: the middle of each locker, where a shirt hangs.
export function lockerRow({ axis, at, from, to, inward }, wood) {
  const count = Math.round((to - from) / LOCKER.width);
  const width = (to - from) / count;
  const place = (along, up, out, sizeAlong, sizeUp, sizeOut) => {
    const geometry = axis === 'x' ? new THREE.BoxGeometry(sizeAlong, sizeUp, sizeOut) : new THREE.BoxGeometry(sizeOut, sizeUp, sizeAlong);
    const outward = at + inward * out;
    return axis === 'x' ? geometry.translate(along, up, outward) : geometry.translate(outward, up, along);
  };
  const { depth, height, panel, shelf } = LOCKER;
  const parts = [
    place((from + to) / 2, height / 2, panel / 2, to - from, height, panel), // back
    place((from + to) / 2, height - panel / 2, depth / 2, to - from, panel, depth), // top
    place((from + to) / 2, SEAT.height / 2, depth + SEAT.depth / 2, to - from, SEAT.height, SEAT.depth), // bench
  ];
  const hooks = [];
  for (let i = 0; i <= count; i++) parts.push(place(from + i * width, height / 2, depth / 2, panel, height, depth));
  for (let i = 0; i < count; i++) {
    const middle = from + (i + 0.5) * width;
    parts.push(place(middle, shelf, depth / 2, width, panel, depth));
    const out = at + inward * depth * 0.5;
    hooks.push(axis === 'x' ? new THREE.Vector3(middle, 0, out) : new THREE.Vector3(out, 0, middle));
  }
  const reach = at + inward * (depth + SEAT.depth);
  const [a, b] = [Math.min(at, reach), Math.max(at, reach)];
  const box = axis === 'x'
    ? new THREE.Box3(new THREE.Vector3(from, 0, a), new THREE.Vector3(to, height, b))
    : new THREE.Box3(new THREE.Vector3(a, 0, from), new THREE.Vector3(b, height, to));
  return { object: solid(parts, wood), boxes: [box], hooks };
}

// A free-standing bench: a wooden seat on two metal legs, `length` long along x or z.
export function bench(centre, length, axis, wood) {
  const alongX = axis === 'x';
  const size = (along, up, across) => (alongX ? [along, up, across] : [across, up, along]);
  const seat = new THREE.BoxGeometry(...size(length, 0.05, SEAT.depth)).translate(centre.x, SEAT.height - 0.025, centre.z);
  const legs = [-1, 1].map((side) => {
    const offset = side * (length / 2 - 0.15);
    return new THREE.BoxGeometry(...size(0.05, SEAT.height - 0.05, SEAT.depth - 0.06))
      .translate(centre.x + (alongX ? offset : 0), (SEAT.height - 0.05) / 2, centre.z + (alongX ? 0 : offset));
  });
  const object = new THREE.Group();
  object.add(solid([seat], wood), solid(legs, { material: METAL, tile: 1 }));
  const half = new THREE.Vector3(...size(length / 2, 0, SEAT.depth / 2));
  const box = new THREE.Box3(centre.clone().sub(half), centre.clone().add(half).setY(SEAT.height));
  return { object, boxes: [box], top: SEAT.height };
}

// A physio treatment bed, 1.9 m long along x: padded top on a metal frame.
export function treatmentBed(centre) {
  const top = 0.72;
  const pad = new THREE.BoxGeometry(1.9, 0.1, 0.7).translate(centre.x, top - 0.05, centre.z);
  const frame = [new THREE.BoxGeometry(1.8, 0.05, 0.6).translate(centre.x, top - 0.13, centre.z)];
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.25, 0.25]) {
    frame.push(new THREE.BoxGeometry(0.05, top - 0.15, 0.05).translate(centre.x + dx, (top - 0.15) / 2, centre.z + dz));
  }
  const object = new THREE.Group();
  object.add(solid([pad], { material: PADDING, tile: 1 }), solid(frame, { material: METAL, tile: 1 }));
  const box = new THREE.Box3(new THREE.Vector3(centre.x - 0.95, 0, centre.z - 0.35), new THREE.Vector3(centre.x + 0.95, top, centre.z + 0.35));
  return { object, boxes: [box], top };
}

// Shower heads on walls: each is { position (on the wall face, at floor level), facing: [x, z] }.
// A pipe up the wall, an arm out and a round head, all merged into one metal mesh.
export function showerHeads(heads) {
  const parts = [];
  for (const { position, facing: [fx, fz] } of heads) {
    const { x, z } = position;
    parts.push(new THREE.CylinderGeometry(0.02, 0.02, 1.2).translate(x + fx * 0.03, 1.5, z + fz * 0.03));
    parts.push(new THREE.BoxGeometry(fx ? 0.3 : 0.04, 0.04, fz ? 0.3 : 0.04).translate(x + fx * 0.17, 2.1, z + fz * 0.17));
    parts.push(new THREE.CylinderGeometry(0.1, 0.06, 0.05).translate(x + fx * 0.32, 2.07, z + fz * 0.32));
    parts.push(new THREE.BoxGeometry(0.12, 0.12, 0.12).translate(x + fx * 0.05, 1.2, z + fz * 0.05)); // tap
  }
  return { object: solid(parts.map((part) => part.toNonIndexed()), { material: METAL, tile: 1 }), boxes: [] };
}

// A room sign hanging from the ceiling, readable from both sides. `row` picks the sign in
// signs.png (0 dressing room, 1 physio, 2 showers, 3 tunnel); `yaw` turns it (0 faces +z).
export function hangingSign(position, yaw, row, signs, ceiling) {
  const object = new THREE.Group();
  for (const side of [0, Math.PI]) {
    const face = new THREE.PlaneGeometry(1.2, 0.3);
    const uv = face.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (3 - row + uv.getY(i)) / 4);
    const mesh = new THREE.Mesh(face, signs);
    mesh.rotation.y = side;
    object.add(mesh);
  }
  for (const dx of [-0.5, 0.5]) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ceiling - position.y), METAL);
    wire.position.set(dx, (ceiling - position.y) / 2, 0);
    object.add(wire);
  }
  object.position.copy(position);
  object.rotation.y = yaw;
  return { object, boxes: [] };
}
