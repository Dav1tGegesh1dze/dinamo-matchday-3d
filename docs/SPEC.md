# Dinamo Road to Goal 3D — Spec & Roadmap

Single source of truth for how the first-person 3D game is built. `CLAUDE.md` says *what* the game
is; this file says *how* and *in which order*.

The 2D game (`dinamo-matchday`) is finished and proven. This project keeps its rules, its questions
and its leaderboard, and replaces the flat top-down view with a first-person 3D world you walk
through with mouse and keyboard.

---

## 1. Glossary (3D terms used here)

| Term | Meaning |
|------|---------|
| **Three.js** | The most widely used JavaScript library for 3D in the browser (built on WebGL). |
| **Mesh** | A 3D object: a shape (geometry) plus a look (material). A wall, a bench, a football. |
| **Material / PBR** | How a surface reacts to light. "Physically based" materials use colour, roughness and metalness maps so wood looks like wood. |
| **Texture map** | An image wrapped onto a surface. A tiled floor is one small image repeated. |
| **glTF / .glb** | The standard 3D model format for the web. Exported from Blender. |
| **Pointer lock** | The browser hides the cursor and feeds raw mouse movement to the page, so the mouse turns your head instead of moving a pointer. Every first-person web game uses it. |
| **Capsule collider** | A pill shape standing in for the player's body when testing against walls. Cheap and it slides along walls instead of catching on corners. |
| **Raycast** | Shooting an invisible line into the scene to find what it hits. Used for "am I looking at the coach?" and for keeping feet on the floor. |
| **Baked lighting** | Light and shadow painted into textures ahead of time in Blender, so the game does almost no lighting work at runtime. |
| **Draw call** | One instruction to the graphics card. Fewer is faster. |

---

## 2. What is carried over from the 2D game, unchanged

These files are copied in as-is and must not fork between the two projects. They contain no Phaser
and no rendering code:

| File | What it holds |
|------|---------------|
| `src/data/questions.js` | The 4 question pools, Georgian and English |
| `src/lib/run.js` | Current run: name, phone, e-mail, start time, stage, scored |
| `src/lib/leaderboard.js` | localStorage save / rank / export / reset |
| `src/lib/i18n.js` | Language choice and UI strings |

When the club supplies real questions, both games get them by copying one file.

---

## 3. Engine (decision: Three.js)

**Recommended: Three.js** with Vite and plain JavaScript.

- Small, loads fast, works offline once bundled, exactly like the 2D game does today.
- Biggest community and the most learning material of any browser 3D library, which matters here.
- We need model loading, a camera, lights, collision maths and animation clips. Three.js has all of
  it without a full engine's weight.

**Alternative: Babylon.js.** More built in (physics, GUI, scene inspector). Better if we wanted a
visual editor or real rigid-body physics. Rejected: roughly 3× the download for features we would
not use, since our collision is a capsule against walls and our UI is HTML.

**Rejected outright:** Unity or Godot exported to WebGL. 20–100 MB builds, slow first load, a whole
new toolchain, and no code shared with the 2D game.

---

## 4. Folder structure

```
index.html
vite.config.js
package.json
public/assets/
  models/            # .glb rooms, props, characters
  textures/          # floor, wall, pitch images
  audio/             # reused from the 2D game
src/
  main.js            # renderer, resize, the stage controller
  stages/
    dressingRoom.js  # first-person walking level
    tunnel.js        # scripted walk out to the pitch
    pitch.js         # defenders, keeper, the goal
  world/
    loader.js        # loads and caches .glb models
    level.js         # builds a stage's meshes, lights and collision shapes
    player.js        # capsule, gravity, walking, head bob
    interact.js      # "look at a thing and press E" prompts
  ui/                # plain HTML overlays
    registration.js
    question.js
    result.js
    hud.js           # timer, kit icons, crosshair
  lib/               # copied from the 2D game: run, leaderboard, i18n
  data/              # copied from the 2D game: questions
docs/SPEC.md
```

**Why:** `stages` are the three places you can be, `world` is the reusable 3D machinery, `ui` is
everything drawn as HTML on top. Same split-by-kind idea that worked in the 2D repo.

---

## 5. Flow and stage controller

Phaser's scene system has no equivalent here, so `src/main.js` holds a small **stage controller**:
one renderer, one canvas, one animation loop. Each stage is an object with `enter()`, `update(dt)`
and `exit()`, owning its own scene and camera. The controller runs only the active stage.

```
registration (HTML) → dressing room (3D) → question 1 → tunnel walk (3D)
→ pitch (3D) → questions 2–4 → result (HTML) → registration
```

**All menus and the quiz are plain HTML/CSS over the canvas.** `question.js` exposes
`askQuestion(stage) → Promise<boolean>`; the 3D stage awaits it while the world is frozen and the
pointer is released. Drawing readable Georgian text inside WebGL is a known pain and buys nothing.

---

## 6. First-person controls (decision: pointer lock, with a click-to-start overlay)

- Mouse turns the head via `PointerLockControls`. WASD or arrows walk, Shift jogs, Space is not used.
- Browsers only allow pointer lock after a click, so the dressing room opens with a
  "Click to look around" overlay. Pressing Escape releases the mouse and pauses; clicking resumes.
- Sensitivity is a single constant, tunable at the stand.
- **Head height 1.7 m, walk speed 3 m/s, jog 5 m/s**, gentle head bob while moving.

**Touch:** pointer lock does not exist on tablets. If the stand turns out to be a touchscreen, the
fallback is an on-screen stick for walking plus drag-to-look, added inside the same input module,
the way the 2D game's joystick was. Not built until the device is confirmed.

**Why first person and not GTA-style third person:** the developer asked for first person. It is
also the cheaper choice, because the player's own body is never on screen, so no player character
model, no walk animation and no camera collision are needed.

---

## 7. Movement and collision (decision: capsule against wall boxes, no physics engine)

- The player is a capsule (radius 0.35 m, height 1.8 m).
- Walls, furniture and doorframes each contribute an axis-aligned box. Each frame the capsule is
  pushed out of any box it overlaps, one axis at a time, so you slide along walls instead of sticking.
- Gravity plus a downward raycast keeps the feet on the floor and handles the one step into the tunnel.
- Interaction is a short raycast from the camera: if it hits something tagged interactive within
  2.5 m, the HUD shows "E — pick up boots" and E triggers it.

**Why no physics engine:** the whole game is a person walking on a flat floor. Cannon-es or Rapier
would add a dependency and a tuning problem for something that is about 60 lines of vector maths.

**Alternative:** `three-mesh-bvh` + capsule sweep against the real level geometry. More accurate on
complex shapes, worth revisiting only if hand-placed boxes become fiddly.

---

## 8. The levels and "normal graphics"

This is the part that decides how good the game looks, and it is mostly an **asset problem, not a
code problem**. The plan is deliberately staged so the game is playable long before it is pretty.

**Stage 1 — blockout (roadmap items 1–6).** Rooms built from boxes with flat colours. Ugly, fully
playable, correct sizes and layout. Every later improvement replaces assets, not code.

**Stage 2 — dressed (roadmap item 7).** Each room is a `.glb` exported from Blender or assembled
from a free CC0 modular interior kit: tiled floor, plastered walls, benches, lockers, a physio bed,
shower tiles, a tunnel with a lit exit. PBR textures at 1024 px, repeated, not unique.

**Stage 3 — lit (roadmap item 8).** One directional "sun" through the tunnel mouth plus warm
ceiling lights, soft shadows from the player's surroundings only, and lightmaps baked in Blender for
everything static. A little bloom on the tunnel exit and the stadium lights.

**Where the models come from.** Nobody on this project is a 3D artist, so in order of preference:
1. Assets the club provides.
2. Free CC0 packs (Kenney, Poly Haven textures and HDRIs, Quaternius characters).
3. Simple shapes we build in code as a last resort, kept behind the same loader so they can be swapped.

**Characters** (coach, two defenders, goalkeeper) are the hardest part. Plan: Quaternius or Mixamo
rigged models with `idle`, `talk`, `run`, `tackle` and `dive` clips, kit colours swapped by material.
Until then they are capsules with a coloured top, loaded by the same code.

**Honest expectation:** "GTA-like" describes the camera and the feeling of walking around a real
space. It does not mean GTA's art budget. With free assets and baked lighting this can look like a
clean, modern indie game. Photoreal stadium crowds are out of scope.

---

## 9. Performance budget (stand laptop, integrated graphics)

| Item | Budget |
|------|--------|
| Frame rate | 60 fps at 1280×720, never below 30 |
| Draw calls per frame | under 150 |
| Triangles on screen | under 300k |
| Real-time lights | 1 directional + ambient; everything else baked |
| Shadow maps | 1, 1024 px, only near the player |
| Total downloaded assets | under 40 MB |

`devicePixelRatio` is capped at 1.5 so a retina screen does not quadruple the work.

---

## 10. Audio

The 2D game's sound files are reused. Footsteps, pickups, the crowd and the stings stay the same.
New: `THREE.PositionalAudio` so the crowd gets louder towards the tunnel mouth, which sells the walk out.

---

## 11. Offline and stand behaviour

Same as the 2D game: `npm run build` makes a static `dist/` that runs from any local server with no
internet. Desktop builds for Mac and Windows come from GitHub Actions, never from a developer
machine, and are published on the repository's Releases page.

---

# ROADMAP

One branch per item, `feature/<short-name>`, small enough for one focused session, in build order.
Acceptance criteria are things that can be checked by playing.

### 1. `feature/project-setup` — it renders and you can walk

Vite + Three.js, the stage controller, a grey room made of boxes, pointer-lock first-person
controls, gravity and wall collision.

- [ ] `npm run dev` opens a 3D room; `npm run build` passes
- [ ] Clicking locks the mouse; moving the mouse looks around; WASD walks; Escape releases
- [ ] You cannot walk through walls or fall through the floor
- [ ] Frame rate stays at 60 fps

### 2. `feature/dressing-room` — the real layout in blockout

Dressing room, corridor, physio room, showers and tunnel mouth at true scale, laid out so a
first-time player needs 40–70 s. Doorways, no ceilings yet.

- [ ] All five spaces exist and connect as described
- [ ] A first run through takes 40–70 s
- [ ] Nowhere can the player get stuck

### 3. `feature/interaction` — pick up your kit

Look-at prompts, E to pick up. Shirt and boots in the dressing room, tape in the physio room. HUD
icons light up. The coach refuses until all three are held.

- [ ] Looking at an item within 2.5 m shows a prompt naming it
- [ ] E picks it up, the item disappears, its HUD icon lights
- [ ] Talking to the coach without all three shows "Get ready first!"

### 4. `feature/question-ui` — the quiz, reused

Copy `questions.js`, `i18n.js`, `run.js` from the 2D repo. HTML question panel over the frozen 3D
world, countdown bar, reveal on wrong, pointer released while it is open.

- [ ] Reaching the coach with the kit asks question 1 with a 20 s countdown
- [ ] Georgian by default, English when chosen
- [ ] Wrong or timeout reveals the correct answer, then game over

### 5. `feature/tunnel-and-pitch` — out into the stadium

Scripted walk out of the tunnel, substitution board with the player's name, receive the ball, then
the three opponents with questions 2–4, ending in GOAL, tackled or saved.

- [ ] The walk out plays by itself and the crowd rises in volume
- [ ] Beating an opponent moves you to the next; a wrong answer ends the run
- [ ] A correct 4th answer scores and stops the timer

### 6. `feature/registration-and-result` — the full loop

Copy `leaderboard.js`. HTML registration form (username, mobile, e-mail) and result screen with the
top 10, Play again, 15 s auto-return, and the admin export and reset.

- [ ] A complete run can be played start to finish and appears on the leaderboard
- [ ] Play again restarts for the same player
- [ ] Ctrl+Shift+E exports every attempt with contact details

**→ At this point the game is fully playable. Everything below is graphics.**

### 7. `feature/models` — dress the world

Replace blockout boxes with `.glb` rooms and props, PBR textures, and character models with idle,
talk, run, tackle and dive clips.

- [ ] No untextured grey boxes remain
- [ ] The coach and opponents are people, not capsules, and they animate

### 8. `feature/lighting` — make it look good

Baked lightmaps for static geometry, one sun through the tunnel, warm interior lights, soft shadows,
a little bloom, and a colour grade.

- [ ] Rooms read as lit spaces with believable shadow
- [ ] The tunnel exit is a bright, inviting target
- [ ] Still 60 fps on the stand laptop

### 9. `feature/stand-mode` — kiosk and downloads

Fullscreen, no right-click, pixel-ratio cap, offline check, and GitHub Actions desktop builds for
Mac and Windows published on the Releases page.

- [ ] Start enters fullscreen and a full run works with no internet
- [ ] A tagged build publishes downloadable Mac and Windows files

---

## Open questions for the developer

1. Stand device: laptop with a mouse, or a touchscreen? First-person mouse look needs a mouse; a
   touchscreen needs the fallback controls described in §6.
2. Does the club have any 3D assets, or should everything come from free CC0 packs?
3. Should this replace the 2D game at the stand, or ship alongside it?
4. Is a ~3 minute run acceptable, given walking in first person is slower than the top-down maze?
