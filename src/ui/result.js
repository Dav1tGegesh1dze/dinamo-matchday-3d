import { run } from '../lib/run.js';
import { save, getRanked, exportJson, reset } from '../lib/leaderboard.js';
import { t } from '../lib/i18n.js';
import { formatTime } from './hud.js';

const RETURN_SECONDS = 15;
const TOP = 10;

const screen = document.getElementById('result');
const headline = document.getElementById('headline');
const subtitle = document.getElementById('subtitle');
const rows = document.getElementById('rows');
const restart = document.getElementById('restart');
let leave = null;
let returnTimer = 0;

function close(next) {
  clearTimeout(returnTimer);
  window.removeEventListener('keydown', onKey);
  screen.hidden = true;
  next();
}

// Enter restarts; hidden admin keys, only on this screen: Ctrl+Shift+E exports every attempt,
// Ctrl+Shift+X asks, then wipes the leaderboard and goes back to registration.
function onKey(event) {
  if (event.key === 'Enter') return close(leave);
  if (!event.ctrlKey || !event.shiftKey) return;
  if (event.code === 'KeyE') exportJson();
  if (event.code === 'KeyX' && window.confirm(t('confirmReset'))) {
    reset();
    close(leave);
  }
}

function row(rank, attempt, own) {
  const item = document.createElement('li');
  item.className = own ? 'own' : '';
  item.textContent = `${rank}. ${attempt.name} — ${formatTime(attempt.timeMs)}`;
  return item;
}

restart.addEventListener('click', () => close(leave));

// Saves this run's attempt and shows it with the leaderboard. Restart (or Enter), 15 s passing, or
// an admin reset all call `back()`, which returns to registration for the next player.
export function showResult(back) {
  leave = back;
  const attempt = {
    name: run.name,
    phone: run.phone,
    email: run.email,
    timeMs: run.finishedAt - run.startedAt,
    stageReached: run.stage,
    scored: run.scored,
    date: new Date().toISOString(),
  };
  save(attempt);

  headline.textContent = run.scored ? t('goal') : run.name;
  subtitle.textContent = run.scored
    ? `${t('yourTime')}: ${formatTime(attempt.timeMs)}`
    : `${t('outAt')}: ${t(`stage${run.stage}`)}`;
  document.getElementById('board-title').textContent = t('leaderboard');
  restart.textContent = t('restart');

  const ranked = getRanked();
  const own = ranked.findIndex((a) => a.date === attempt.date);
  const shown = ranked.slice(0, TOP).map((a, i) => row(i + 1, a, i === own));
  if (own >= TOP) shown.push(row(own + 1, attempt, true));
  if (ranked.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = t('noScores');
    shown.push(empty);
  }
  rows.replaceChildren(...shown);

  screen.hidden = false;
  window.addEventListener('keydown', onKey);
  returnTimer = setTimeout(() => close(leave), RETURN_SECONDS * 1000);
}
