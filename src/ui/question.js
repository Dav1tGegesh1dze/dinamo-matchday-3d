import { questions, COUNTDOWN_SECONDS, POOL_BY_STAGE } from '../data/questions.js';
import { getLang } from '../lib/i18n.js';
import { setStage } from '../lib/run.js';

const REVEAL_MS = 1500; // how long a wrong answer shows the right one
const CONFIRM_MS = 600;

const panel = document.getElementById('question');
const text = document.getElementById('question-text');
const answers = document.getElementById('answers');
const bar = document.getElementById('bar');
const seconds = document.getElementById('seconds');

// Asks a random question from the pool for `stage` (1 easy … 4 hardest) with shuffled answers and a
// countdown; timing out counts as wrong. Releases the mouse, so the 3D world is paused while it is
// open. Resolves true or false once the answer has been shown.
export function askQuestion(stage) {
  setStage(stage);
  document.exitPointerLock();
  const pool = questions[POOL_BY_STAGE[stage - 1]];
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const question = entry[getLang()];
  const order = shuffle([0, 1, 2, 3]);
  const limit = COUNTDOWN_SECONDS[stage - 1];

  text.textContent = question.text;
  const buttons = order.map((index) => {
    const button = document.createElement('button');
    button.textContent = question.answers[index];
    button.dataset.index = index;
    return button;
  });
  answers.replaceChildren(...buttons);
  panel.hidden = false;

  const endsAt = performance.now() + limit * 1000;
  return new Promise((resolve) => {
    const answer = (button) => {
      // A click on an answer is the one moment the browser lets the game take the mouse back, so
      // play carries on without another "Click to play". A timeout still needs that click.
      if (button) document.querySelector('canvas').requestPointerLock();
      clearInterval(ticker);
      buttons.forEach((b) => (b.disabled = true));
      const right = buttons.find((b) => Number(b.dataset.index) === entry.correct);
      right.classList.add('right');
      if (button && button !== right) button.classList.add('wrong');
      setTimeout(() => {
        panel.hidden = true;
        resolve(button === right);
      }, button === right ? CONFIRM_MS : REVEAL_MS);
    };
    const tick = () => {
      const left = Math.max(0, (endsAt - performance.now()) / 1000);
      seconds.textContent = Math.ceil(left);
      bar.style.transform = `scaleX(${left / limit})`;
      if (left === 0) answer(null);
    };
    const ticker = setInterval(tick, 100);
    tick();
    buttons.forEach((button) => button.addEventListener('click', () => answer(button)));
  });
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
