import * as THREE from 'three';
import { loadTexture } from './loader.js';
import { GLOW } from './graphics.js';

// The fans in the stands: flat cut-outs from fans.png (8 fans, each with arms down and arms up,
// rendered from the footballer model), one per seat or so, all drawn in one call. Each faces the
// pitch and bounces to its own rhythm; the vertex shader moves them, so they cost the CPU nothing.
// excite(level, flashes) sets how many cheer and jump (0 quiet … 1 a goal) and how many camera
// flashes spark in the stands.
const SHEET = { columns: 8 };
const FAN = { width: 1.24, height: 1.4, seatHeight: 0.4 }; // the sprite covers waist to raised hands
const SPACING = { seat: 0.9, row: 1.25 };
const OCCUPIED = 0.85;
const TINT = 0xb4b8c4; // the fans are drawn unlit; this matches the floodlit stands
const FLASHES = { count: 400, size: 0.6, rate: 10 }; // rate: chances per second to spark
const EASE = 2; // how fast the crowd's mood follows excite()

export function createCrowd(tiers) {
  const fans = [];
  for (const [[a0, b0, y0], [a1, b1, y1]] of tiers) {
    const rows = Math.floor(Math.hypot(a1 - a0, y1 - y0) / SPACING.row);
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.5) / rows;
      const [a, b, y] = [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, y0 + (y1 - y0) * t];
      const seats = Math.floor((2 * Math.PI * Math.sqrt((a * a + b * b) / 2)) / SPACING.seat);
      for (let seat = 0; seat < seats; seat++) {
        if (Math.random() > OCCUPIED) continue;
        const angle = (seat / seats) * Math.PI * 2;
        fans.push(new THREE.Vector3(a * Math.cos(angle), y + FAN.seatHeight, b * Math.sin(angle)));
      }
    }
  }

  const geometry = new THREE.PlaneGeometry(FAN.width, FAN.height).translate(0, FAN.height / 2, 0);
  const material = new THREE.MeshBasicMaterial({ map: loadTexture('fans.png'), color: TINT, alphaTest: 0.5, alphaToCoverage: true });
  const uniforms = { uTime: { value: 0 }, uExcitement: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      attribute float aFan;
      attribute float aPhase;
      attribute float aPace;
      uniform float uTime;
      uniform float uExcitement;
      ${shader.vertexShader}`
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        // Some fans have their arms up at any moment, most of them when excited.
        float cheering = step(1.0 - 0.25 - 0.75 * uExcitement, 0.5 + 0.5 * sin(uTime * aPace * 1.3 + aPhase * 3.0));
        vMapUv = vec2((uv.x + aFan) / ${SHEET.columns.toFixed(1)}, (uv.y + 1.0 - cheering) / 2.0);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += max(0.0, sin(uTime * aPace * 6.0 + aPhase)) * (0.04 + 0.3 * uExcitement);`);
  };
  const mesh = new THREE.InstancedMesh(geometry, material, fans.length);
  const fan = new THREE.Object3D();
  const variety = { aFan: [], aPhase: [], aPace: [] };
  fans.forEach((position, i) => {
    fan.position.copy(position);
    fan.rotation.y = Math.atan2(-position.x, -position.z); // faces the centre spot
    fan.updateMatrix();
    mesh.setMatrixAt(i, fan.matrix);
    variety.aFan.push(Math.floor(Math.random() * SHEET.columns));
    variety.aPhase.push(Math.random() * Math.PI * 2);
    variety.aPace.push(0.8 + Math.random() * 0.6);
  });
  for (const [name, values] of Object.entries(variety)) {
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), 1));
  }

  const flashes = cameraFlashes(fans, uniforms.uTime);
  const object = new THREE.Group();
  object.add(mesh, flashes.points);
  const mood = { excitement: 0, flashes: 0 };
  const target = { excitement: 0, flashes: 0 };

  return {
    object,

    excite(excitement, flashCount) {
      Object.assign(target, { excitement, flashes: flashCount });
    },

    update(dt) {
      uniforms.uTime.value += dt;
      for (const key of Object.keys(mood)) mood[key] += (target[key] - mood[key]) * Math.min(1, EASE * dt);
      uniforms.uExcitement.value = mood.excitement;
      flashes.uniform.value = mood.flashes;
    },
  };
}

// Phone and camera flashes: bright points in front of random fans, each sparking for a moment at
// random, more of them the higher `uFlashes` (0…1).
function cameraFlashes(fans, uTime) {
  const positions = [];
  const seeds = [];
  for (let i = 0; i < FLASHES.count; i++) {
    const fan = fans[Math.floor(Math.random() * fans.length)];
    positions.push(fan.x * 0.99, fan.y + FAN.height * 0.8, fan.z * 0.99);
    seeds.push(Math.random() * 1000);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(0xffffff).multiplyScalar(GLOW),
    size: FLASHES.size,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const uniform = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uFlashes = uniform;
    shader.vertexShader = `
      attribute float aSeed;
      uniform float uTime;
      uniform float uFlashes;
      ${shader.vertexShader}`.replace('gl_PointSize = size;', `
        float moment = floor(uTime * ${FLASHES.rate.toFixed(1)} + aSeed);
        float spark = step(1.0 - 0.06 * uFlashes, fract(sin(moment * 12.9898 + aSeed) * 43758.5453));
        gl_PointSize = size * spark;`);
  };
  return { points: new THREE.Points(geometry, material), uniform };
}
