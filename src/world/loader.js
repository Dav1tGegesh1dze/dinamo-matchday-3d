import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Every model the game shows comes through loadModel(name), from public/assets/models/<name>.glb.
// Each file is downloaded once; every call returns its own copy, so one model can be several people.
// Until a real model exists, its name maps to a blockout placeholder here instead; adding the .glb
// and deleting the placeholder changes no caller.
const PLACEHOLDERS = {
  ball: () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), new THREE.MeshStandardMaterial({ color: 0xffffff })),
  board: () => box(0.9, 0.55, 0.06, 0x111111),
  // A regulation goal (7.32 × 2.44 m) on the goal line, its mouth facing +x, with a see-through net.
  goal: () => {
    const goal = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44);
    for (const z of [-3.66, 3.66]) {
      const upright = new THREE.Mesh(post, white);
      upright.position.set(0, 1.22, z);
      goal.add(upright);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44).rotateX(Math.PI / 2), white);
    bar.position.y = 2.44;
    const net = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2.44, 7.32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    net.position.set(-1, 1.22, 0);
    goal.add(bar, net);
    return goal;
  },
};
const gltfLoader = new GLTFLoader();
const cache = new Map();
const textureLoader = new THREE.TextureLoader();

export async function loadModel(name) {
  if (PLACEHOLDERS[name]) return { scene: PLACEHOLDERS[name](), animations: [] };
  if (!cache.has(name)) cache.set(name, gltfLoader.loadAsync(`assets/models/${name}.glb`).then(boundSkins));
  const gltf = await cache.get(name);
  return { scene: clone(gltf.scene), animations: gltf.animations };
}

// A skinned part works out its bounds from its posed vertices the first time it is drawn, a few
// milliseconds each. Done once here on the loaded original, every copy inherits them.
function boundSkins(gltf) {
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    node.skeleton.update();
    node.computeBoundingSphere();
  });
  return gltf;
}

// A repeating colour texture from public/assets/textures/<name>.
export function loadTexture(name, anisotropy = 8) {
  const map = textureLoader.load(`assets/textures/${name}`);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  return map;
}

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
}
