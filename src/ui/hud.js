// The HTML layer over the 3D view: kit icons (dim until picked up), the interaction prompt and short
// messages such as "Get ready first!".
const MESSAGE_SECONDS = 2;

const kit = document.getElementById('kit');
const prompt = document.getElementById('prompt');
const message = document.getElementById('message');
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
