// 0 = never reached the coach, 1 = coach, 2 = defender 1, 3 = defender 2, 4 = goalkeeper
export const run = { name: '', phone: '', email: '', startedAt: 0, finishedAt: 0, stage: 0, scored: false };

export function startRun({ name, phone, email }) {
  run.name = name;
  run.phone = phone;
  run.email = email;
  run.startedAt = Date.now();
  run.finishedAt = 0;
  run.stage = 0;
  run.scored = false;
}

export function setStage(stage) {
  run.stage = stage;
}

export function finishRun(scored) {
  run.finishedAt = Date.now();
  run.scored = scored;
}
