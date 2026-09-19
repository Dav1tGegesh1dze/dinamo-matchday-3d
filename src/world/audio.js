import * as THREE from 'three';

// All sounds are the 2D game's .wav files in public/assets/audio, loaded once at startup. The
// listener rides on the active stage's camera, so positional sounds pan and fade with the view.
const NAMES = ['whistle', 'correct', 'wrong', 'pickup', 'tackle', 'save', 'goal', 'step', 'crowd', 'maze-music'];

export const listener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
const buffers = Object.fromEntries(NAMES.map((name) => [name, audioLoader.loadAsync(`assets/audio/${name}.wav`)]));

// Browsers keep audio silent until the first click; Start is that click.
export function unlockAudio() {
  listener.context.resume();
}

export async function play(name, volume = 1) {
  const sound = new THREE.Audio(listener);
  sound.setBuffer(await buffers[name]);
  sound.setVolume(volume);
  sound.play();
}

export async function loop(name, volume) {
  const sound = new THREE.Audio(listener);
  sound.setBuffer(await buffers[name]);
  sound.setLoop(true);
  sound.setVolume(volume);
  sound.play();
  return sound;
}

// A looping sound coming from `object`, full volume within `near` metres and fading with distance.
export async function loopAt(name, volume, object, near) {
  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(await buffers[name]);
  sound.setLoop(true);
  sound.setVolume(volume);
  sound.setRefDistance(near);
  object.add(sound);
  sound.play();
  return sound;
}
