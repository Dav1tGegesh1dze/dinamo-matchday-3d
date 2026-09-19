const KEY = 'dinamo-leaderboard';

export function getAll() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function save(attempt) {
  localStorage.setItem(KEY, JSON.stringify([...getAll(), attempt]));
}

export function getRanked() {
  return getAll()
    .filter((a) => a.scored)
    .sort((a, b) => a.timeMs - b.timeMs);
}

export function exportJson() {
  const blob = new Blob([JSON.stringify(getAll(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `dinamo-results-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function reset() {
  localStorage.removeItem(KEY);
}
