import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Every model the game shows comes through loadModel(name), from public/assets/models/<name>.glb.
// Each file is downloaded once; every call returns its own copy, so one model can be several people.
const gltfLoader = new GLTFLoader();
const cache = new Map();

export async function loadModel(name) {
  if (!cache.has(name)) cache.set(name, gltfLoader.loadAsync(`assets/models/${name}.glb`));
  const gltf = await cache.get(name);
  return { scene: clone(gltf.scene), animations: gltf.animations };
}
