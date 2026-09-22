// The HTML layer over the 3D view: kit icons (dim until picked up), the interaction prompt, short
// messages such as "Get ready first!", the substitution board's text, the objective with its marker,
// and the run timer.
const MESSAGE_SECONDS = 2;

const kit = document.getElementById('kit');
const prompt = document.getElementById('prompt');
const message = document.getElementById('message');
const board = document.getElementById('board');
const objective = document.getElementById('objective');
const marker = document.getElementById('marker');
const markerDistance = document.getElementById('marker-distance');
const markerPointer = document.getElementById('marker-pointer');
const timer = document.getElementById('timer');
let messageTimer = 0;

export function showKit(items) {
  kit.replaceChildren(
    ...items.map((name) => {
      const icon = document.createElement('img');
      icon.src = `assets/icons/${name}.png`;
      icon.dataset.item = name;
      return icon;
    }),
  );
}

export function lightKit(name) {
  kit.querySelector(`[data-item="${name}"]`).classList.add('held');
}

export function showPrompt(text) {
  prompt.textContent = text ?? '';
  prompt.hidden = !text;
}

export function flash(text) {
  message.textContent = text;
  message.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (message.hidden = true), MESSAGE_SECONDS * 1000);
}

// The substitution board's LED text, centred on screen point x, y.
export function showBoard(text, x, y) {
  board.textContent = text;
  board.style.left = `${x}px`;
  board.style.top = `${y}px`;
  board.hidden = false;
}

export function hideBoard() {
  board.hidden = true;
}

// What to do now, at the top of the screen, with a smaller hint under it; null hides it.
export function showObjective(text, hint) {
  objective.hidden = !text;
  if (!text) return;
  const small = document.createElement('small');
  small.textContent = hint;
  objective.replaceChildren(text, small);
}

// The objective's marker at screen point x, y: a pin with the distance over it, or, when the target
// is off screen, an arrow at the screen edge turned `angle` radians (clockwise from right) towards it.
export function showMarker(distance, x, y, angle) {
  markerDistance.textContent = distance;
  markerPointer.textContent = angle === null ? '▼' : '➤';
  markerPointer.style.transform = angle === null ? '' : `rotate(${angle}rad)`;
  marker.classList.toggle('off', angle !== null);
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.hidden = false;
}

export function hideMarker() {
  marker.hidden = true;
}

export function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

// The run clock: counts from Start and freezes when the run finishes.
export function showTimer({ startedAt, finishedAt }) {
  timer.textContent = formatTime((finishedAt || Date.now()) - startedAt);
}
