// The HTML layer over the 3D view: kit icons (dim until picked up), the interaction prompt, short
// messages such as "Get ready first!", and the substitution board's text.
const MESSAGE_SECONDS = 2;

const kit = document.getElementById('kit');
const prompt = document.getElementById('prompt');
const message = document.getElementById('message');
const board = document.getElementById('board');
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
