# Dinamo Road to Goal 3D — First-Person Stand Game

A first-person 3D remake of the 2D stand game (`dinamo-matchday`). Same story and rules, now walked
in first person with real 3D graphics. One device, one player at a time, about 3 minutes per run.

## Tech
- Three.js + Vite + plain JavaScript (no TypeScript, no framework, no backend)
- Must work fully offline once loaded
- Storage: browser localStorage only
- Keep code simple. Zero dead code, no unused abstractions, no features not listed here.

## Game flow
1. **Registration** – username, mobile number, e-mail. The run timer starts on Start.
2. **Dressing room (first person)** – find your shirt and boots, then the tape in the physio room,
   then the coach at the tunnel mouth. Mouse looks, WASD walks.
3. **Question 1 (easy)** – the coach asks. Correct → substituted in. Wrong → game over.
4. **Tunnel walk (automatic)** – walk out into the stadium, substitution board, receive the ball.
5. **Defender 1** – Question 2 (medium). Correct → go past. Wrong → tackled → game over.
6. **Defender 2** – Question 3 (hard).
7. **Goalkeeper** – one-on-one, Question 4 (hardest). Correct → GOAL, timer stops.
8. **Result** – time or stage reached, leaderboard, Play again, auto-return after ~15 s.

## Rules carried over from the 2D game
- Exactly 4 questions per run: easy, medium, hard, hardest. Pools of ~3, shuffled answers.
- Countdown per question: 20s, 15s, 12s, 10s. Timeout = wrong.
- Georgian (default) and English.
- Save every attempt: `{ name, phone, email, timeMs, stageReached, scored, date }`
- Ranking: `scored === true`, fastest `timeMs` first. Admin export and reset.

## Assets
- All models, textures and sounds come from files in `public/assets/`, never generated in code.
- Placeholder geometry is fine until real assets exist, but it must load through the same code path.

## Workflow rules (always follow)
- The plan and roadmap live in `docs/SPEC.md`. Read it before starting any feature.
- Branches: `main` (final release only, protected on GitHub: no direct pushes, changes only via pull
  request), `develop` (integration), `feature/<short-name>` (one per roadmap item).
- NEVER commit or push to `main` (GitHub also blocks it).
- Every feature: branch from latest `develop` → implement → `npm run build` passes →
  verify the acceptance criteria yourself (headless browser smoke test) → commit → push →
  open a PR into `develop` with `gh pr create`, acceptance criteria as a checklist →
  merge it yourself with `gh pr merge --merge --delete-branch`. The developer does not review PRs by
  hand; report what was verified and what was not.
- One feature per branch. Do not touch files outside the feature's scope. No drive-by refactors.
- Build order: ugly full flow first, graphics polish last.
