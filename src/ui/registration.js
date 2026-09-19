import { getLang, setLang, t } from '../lib/i18n.js';

// [field, validator on the trimmed value, error string key], the same rules as the 2D game.
const RULES = [
  ['name', (v) => v.length >= 2 && v.length <= 20, 'errName'],
  ['phone', (v) => /^\+?\d{9,15}$/.test(v), 'errPhone'],
  ['email', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'errEmail'],
];

const screen = document.getElementById('registration');
const inputs = Object.fromEntries(RULES.map(([id]) => [id, document.getElementById(id)]));
const error = document.getElementById('error');
const start = document.getElementById('start');
let onStart = null;

function values() {
  const entered = Object.fromEntries(RULES.map(([id]) => [id, inputs[id].value.trim()]));
  entered.phone = entered.phone.replace(/[\s-]/g, '');
  return entered;
}

function firstInvalid() {
  const entered = values();
  return RULES.find(([id, valid]) => !valid(entered[id]));
}

function refresh() {
  const invalid = firstInvalid();
  start.classList.toggle('dim', Boolean(invalid));
  if (!invalid) error.textContent = '';
}

function tryStart() {
  const invalid = firstInvalid();
  if (invalid) {
    error.textContent = t(invalid[2]);
    inputs[invalid[0]].focus();
    return;
  }
  screen.hidden = true;
  onStart(values());
}

function translate() {
  document.getElementById('title').textContent = t('title');
  for (const [id] of RULES) inputs[id].placeholder = t(`${id}Placeholder`);
  start.textContent = t('start');
  for (const button of document.querySelectorAll('#languages button')) {
    button.classList.toggle('chosen', button.dataset.lang === getLang());
  }
}

for (const input of Object.values(inputs)) {
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (event) => event.key === 'Enter' && tryStart());
}
start.addEventListener('click', tryStart);
for (const button of document.querySelectorAll('#languages button')) {
  button.addEventListener('click', () => {
    setLang(button.dataset.lang);
    translate();
    if (error.textContent) error.textContent = t(firstInvalid()[2]);
  });
}

// Shows the empty form for a new player; `started(player)` gets { name, phone, email } on Start.
export function showRegistration(started) {
  onStart = started;
  for (const input of Object.values(inputs)) input.value = '';
  error.textContent = '';
  translate();
  refresh();
  screen.hidden = false;
  inputs.name.focus();
}
