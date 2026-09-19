import { showPrompt } from '../ui/hud.js';

const RANGE = 2; // metres from the player
const FACING = 0.5; // cos 60°: the thing must be within 60° of where the player faces

let pressed = false;
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE' && !event.repeat && document.pointerLockElement) pressed = true;
});

// "Stand near a thing and press E". Each thing is { position, prompt(), use() }. Every frame the
// nearest thing in range and in front of the player gets its prompt shown, and E uses it.
export function updateInteractions(player, things) {
  const facingX = Math.sin(player.rotation.y);
  const facingZ = Math.cos(player.rotation.y);
  let target = null;
  let nearest = RANGE;
  for (const thing of things) {
    const dx = thing.position.x - player.position.x;
    const dz = thing.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearest && (dx * facingX + dz * facingZ) / distance >= FACING) {
      target = thing;
      nearest = distance;
    }
  }
  showPrompt(target && target.prompt());
  if (pressed && target) target.use();
  pressed = false;
}
