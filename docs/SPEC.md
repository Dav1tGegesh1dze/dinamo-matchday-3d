# Dinamo Road to Goal 3D — Spec & Roadmap

Single source of truth for how the third-person 3D game is built. `CLAUDE.md` says *what* the game
is; this file says *how* and *in which order*.

The 2D game (`dinamo-matchday`) is finished and proven. This project keeps its rules, its questions
and its leaderboard, and replaces the flat top-down view with a 3D world you walk through as your
own Dinamo player, seen from behind like GTA. The 3D game **replaces** the 2D game at the stand.

---

## 1. Decisions (answered by the developer)

| Question | Answer |
|----------|--------|
| Camera | **Third person, GTA-style**: the camera sits behind the player's shoulder |
| Stand device | **Laptop with mouse and keyboard**. No touch controls |
| 3D assets | **Free CC0 packs** (Kenney, Quaternius, Poly Haven, Mixamo) |
| Relation to the 2D game | **Replaces it**. One game at the stand, with its own leaderboard |

---

## 2. Glossary (3D terms used here)

| Term | Meaning |
|------|---------|
| **Three.js** | The most widely used JavaScript library for 3D in the browser (built on WebGL). |
| **Mesh** | A 3D object: a shape (geometry) plus a look (material). A wall, a bench, a football. |
| **Material / PBR** | How a surface reacts to light. "Physically based" materials use colour, roughness and metalness maps so wood looks like wood. |
| **Texture map** | An image wrapped onto a surface. A tiled floor is one small image repeated. |
| **glTF / .glb** | The standard 3D model format for the web. Exported from Blender. |
| **Rigged model / skinned mesh** | A character model with a skeleton inside, so it can bend and animate. |
| **Animation clip** | One named movement stored in a model file: `idle`, `walk`, `kick`. Three.js plays and blends them with an `AnimationMixer`. |
| **Third-person camera** | A camera that follows behind the player. The mouse orbits it around the player; it never passes through walls. |
| **Pointer lock** | The browser hides the cursor and sends raw mouse movement to the page, so the mouse turns the camera instead of moving a pointer. |
| **Capsule collider** | A pill shape standing in for the player's body when testing against walls. Cheap, and it slides along walls instead of catching on corners. |
| **Raycast** | Shooting an invisible line into the scene to find what it hits. Used for "is the coach in front of me?", for keeping feet on the floor and for pulling the camera in front of walls. |
| **Baked lighting** | Light and shadow painted into textures ahead of time in Blender, so the game does almost no lighting work at runtime. |
| **Draw call** | One instruction to the graphics card. Fewer is faster. |

---

## 3. What is carried over from the 2D game

**Copied unchanged.** These files contain no Phaser and no rendering code:

| File | What it holds |
|------|---------------|
| `src/data/questions.js` | The 4 question pools in Georgian and English, and `COUNTDOWN_SECONDS` |
| `src/lib/run.js` | Current run: name, phone, e-mail, start time, stage, scored |
| `src/lib/leaderboard.js` | localStorage save / rank / export / reset |
| `src/lib/i18n.js` | Language choice and UI strings. New 3D strings are added here |

When the club supplies real questions, the updated `questions.js` is copied in.

**Rebuilt, same behaviour.** These were written for Phaser. The 3D game rewrites them as plain HTML
or Three.js with the same rules:
- Registration validation: name 2–20 characters, mobile 9–15 digits, a valid e-mail.
- Question panel: shuffled answers, countdown bar, correct answer revealed on wrong or timeout.
- Result screen: the top 10 with the current player highlighted, Play again (button or Enter),
  auto-return after 15 s.
- Admin, on the result screen only: **Ctrl+Shift+E** exports every attempt as JSON, and
  **Ctrl+Shift+X** asks for confirmation, then resets the leaderboard.

**Reused as-is.** The sound files (`.wav`) in `public/assets/`, the desktop wrapper
`electron/main.cjs` and the `.github/workflows/release.yml` workflow.

**Not carried over.** The touch joystick and the 5-tap admin panel, because the stand has no
touchscreen. Also Phaser itself, the pixel-art sprites and `maze.json`.

---

## 4. Engine (decision: Three.js)

**Chosen: Three.js** with Vite and plain JavaScript.

- Small, loads fast, and works offline once bundled, exactly like the 2D game.
- The biggest community and the most learning material of any browser 3D library.
- It has everything this game needs: model loading, animation clips, a camera, lights and raycasts,
  without a full engine's weight.

**Alternative: Babylon.js.** More built in (physics, GUI, scene inspector). Rejected: roughly 3× the
download for features we would not use, since our collision is a capsule against boxes and our UI
is HTML.

**Rejected outright:** Unity or Godot exported to WebGL. Those builds are 20–100 MB, load slowly,
need a whole new toolchain and share no code with the 2D game.

---

## 5. Folder structure

```
index.html
vite.config.js
package.json
electron/main.cjs    # copied from the 2D game (roadmap item 10)
public/assets/
  models/            # .glb rooms, props, characters
  textures/          # floor, wall, pitch images
  audio/             # the 2D game's .wav files
src/
  main.js            # renderer, resize, the stage controller
  stages/
    dressingRoom.js  # the walkable level
    tunnel.js        # scripted walk out to the pitch
    pitch.js         # defenders, keeper, the goal
  world/
    loader.js        # loads and caches .glb models
    level.js         # builds a stage's meshes, lights and collision boxes
    player.js        # capsule, gravity, movement relative to the camera
    camera.js        # third-person follow camera, mouse orbit, wall pull-in
    character.js     # a rigged model plus its animation clips (player, coach, opponents)
    interact.js      # "stand near a thing and press E" prompts
  ui/                # plain HTML overlays
    registration.js
    question.js
    result.js
    hud.js           # timer, kit icons, interaction prompt
  lib/               # copied from the 2D game: run, leaderboard, i18n
  data/              # copied from the 2D game: questions
docs/SPEC.md
```

**Why:** `stages` are the three places you can be, `world` is the reusable 3D machinery, `ui` is
everything drawn as HTML on top. This is the same split-by-kind idea that worked in the 2D repo.

---

## 6. Flow and stage controller

Three.js has nothing like Phaser's scene system, so `src/main.js` holds a small **stage
controller**: one renderer, one canvas, one animation loop. Each stage is an object with `enter()`,
`update(dt)` and `exit()`, and owns its own scene and camera. The controller runs only the active
stage.

```
registration (HTML) → dressing room (3D) → question 1 → tunnel walk (3D)
→ pitch (3D) → questions 2–4 → result (HTML) → registration
```

`run.stage` follows the 2D numbering and is saved as `stageReached`: 0 = never reached the coach,
1 = coach, 2 = defender 1, 3 = defender 2, 4 = goalkeeper.

**All menus and the quiz are plain HTML/CSS over the canvas.** `question.js` exposes
`askQuestion(stage) → Promise<boolean>`. The 3D stage waits for it while the world is frozen and
the mouse is released. Readable Georgian text is hard to draw inside WebGL, and there is nothing to
gain from doing it.

---

## 7. Third-person controls and camera

**Camera (decision: over-the-shoulder follow camera, mouse orbit with pointer lock).**
- The camera sits about 3.5 m behind the player and 0.5 m to the right, aimed at head height.
- The mouse orbits it: horizontal movement turns it around the player, vertical movement tilts it
  between −30° and +60°. Sensitivity is one constant that can be adjusted at the stand.
- **Wall pull-in:** each frame a raycast runs from the player's head to where the camera wants to
  be. If it hits a wall, the camera moves in front of the hit point, so it never shows the inside
  of a wall. It eases back out when the space opens up.
- The camera follows with light smoothing so it doesn't jitter.

**Movement.**
- WASD or the arrow keys move the player **relative to the camera**, like GTA: W walks away from
  the camera. The character turns smoothly to face the direction of travel.
- Shift jogs. Space and jumping are not used.
- **Walk 3 m/s, jog 5 m/s.** The animation blends between `idle`, `walk` and `jog` based on speed.

**Pointer lock.** Browsers only allow it after a click, so the dressing room opens with a
"Click to start" overlay. Escape releases the mouse and pauses; clicking resumes.

**Why not first person:** the developer chose GTA-style. Seeing your own Dinamo player also pays
off in the tunnel walk and the shot on goal. The cost is a rigged player model with animations
(roadmap item 8) and the camera wall pull-in above.

---

## 8. Movement and collision (decision: capsule against wall boxes, no physics engine)

- The player is a capsule (radius 0.35 m, height 1.8 m).
- Walls, furniture and doorframes each add an axis-aligned box. Each frame the capsule is pushed
  out of any box it overlaps, one axis at a time, so you slide along walls instead of sticking.
- Gravity plus a downward raycast keeps the feet on the floor and handles the one step into the
  tunnel.
- The camera raycast in §7 tests against the same wall boxes.
- **Interaction:** when an interactive thing is within 2 m of the player and in front of them, the
  HUD shows "E — pick up boots" and E triggers it. In third person the player's position is a
  better test than the centre of the screen, because the camera is behind you.

**Why no physics engine:** the whole game is a person walking on a flat floor. Cannon-es or Rapier
would add a dependency and a tuning problem for about 60 lines of vector maths.

**Alternative:** `three-mesh-bvh` with a capsule sweep against the real level geometry. Only worth
revisiting if hand-placed boxes become fiddly.

---

## 9. The levels and "normal graphics"

How good the game looks is mostly an **asset problem, not a code problem**. The plan is deliberately
staged, so the game is playable long before it is pretty.

**Stage 1 — blockout (roadmap items 1–7).** Rooms built from boxes with flat colours, and characters
as capsules with a coloured top. Ugly, but fully playable at the correct sizes and layout. Every
later improvement replaces assets, not code.

**Stage 2 — dressed (roadmap items 8–9).** Your player, the coach and the opponents become rigged
people. Each room is a `.glb` assembled from a free CC0 modular interior kit: tiled floor, plastered
walls, benches, lockers, a physio bed, shower tiles, a tunnel with a lit exit. PBR textures at
1024 px, repeated rather than unique.

**Stage 3 — lit (roadmap item 10).** One directional "sun" through the tunnel mouth, warm ceiling
lights, soft shadows near the player, and lightmaps baked in Blender for everything static. A
little bloom on the tunnel exit and the stadium lights.

**Room sizes for a third-person camera.** Corridors and doorways at least 2.5 m wide and ceilings at
least 3 m high. A camera behind you needs room, or it is pulled in constantly and the view feels
cramped.

**Where the models come from** (all CC0 or free for commercial use):
1. Kenney modular interior and sports kits, for rooms and props.
2. Poly Haven, for PBR textures and a stadium-sky HDRI.
3. Quaternius or Mixamo, for rigged people with animation clips.

Blockout shapes built in code are allowed only as placeholders during Stage 1, and they are created
through the same loader, so replacing them later changes no game code.

**Characters.** One rigged human model is reused for everyone, with kit colours swapped by material:
- **Player:** Dinamo blue and white. Clips: `idle`, `walk`, `jog`, `kick`.
- **Coach:** tracksuit. Clips: `idle`, `talk`.
- **Defenders:** opponent colours. Clips: `idle`, `run`, `tackle`.
- **Goalkeeper:** keeper kit. Clips: `idle`, `dive`.

**Honest expectation:** "GTA-like" describes the camera and the feeling of walking through a real
space. It does not mean GTA's art budget. With free assets and baked lighting this can look like a
clean, modern indie game. Photorealistic players and stadium crowds are out of scope; the crowd is
sound plus a simple stand texture.

---

## 10. Performance budget (stand laptop, integrated graphics)

| Item | Budget |
|------|--------|
| Frame rate | 60 fps at 1280×720, never below 30 |
| Draw calls per frame | under 150 |
| Triangles on screen | under 300k |
| Animated characters on screen | at most 4 (player + coach, or player + 3 opponents) |
| Real-time lights | 1 directional + ambient; everything else baked |
| Shadow maps | 1, 1024 px, only near the player |
| Total downloaded assets | under 40 MB |

`devicePixelRatio` is capped at 1.5, so a retina screen does not quadruple the work.

---

## 11. Audio

The 2D game's sound files are reused. Footsteps, pickups, the crowd and the stings stay the same,
played through Three.js's audio classes. Footsteps are timed to the walk and jog animations. New:
`THREE.PositionalAudio` makes the crowd get louder towards the tunnel mouth, which sells the walk
out.

---

## 12. Offline and stand behaviour

Same as the 2D game. `npm run build` makes a static `dist/` that runs from any local server with no
internet. The desktop app is the 2D game's Electron wrapper, opening `dist/index.html` fullscreen.
Mac and Windows builds come from GitHub Actions, never from a developer machine, and are published
on the repository's Releases page.

---

# ROADMAP

One branch per item, `feature/<short-name>`, small enough for one focused session, in build order.
Acceptance criteria are things that can be checked by playing.

### 1. `feature/project-setup` — it renders and you can walk in third person

Vite + Three.js, the stage controller, a grey room made of boxes, a capsule player, the
third-person follow camera with mouse orbit and wall pull-in, movement relative to the camera,
gravity and wall collision.

- [ ] `npm run dev` opens a 3D room with a capsule player seen from behind; `npm run build` passes
- [ ] Clicking locks the mouse; moving the mouse orbits the camera; WASD moves relative to the camera; Escape releases
- [ ] The player cannot walk through walls or fall through the floor
- [ ] Backing the camera into a wall pulls it in front of the wall instead of showing through it
- [ ] Frame rate stays at 60 fps

### 2. `feature/dressing-room` — the real layout in blockout

Dressing room, corridor, physio room, showers and tunnel mouth at true scale, with corridors and
doorways at least 2.5 m wide, laid out so a first-time player needs 40–70 s. Doorways, no ceilings
yet.

- [ ] All five spaces exist and connect as described
- [ ] A first run through takes 40–70 s
- [ ] Nowhere can the player get stuck, and the camera never ends up inside a wall

### 3. `feature/interaction` — pick up your kit

Proximity prompts, E to pick up. Shirt and boots in the dressing room, tape in the physio room. HUD
icons light up. The coach refuses until all three are held.

- [ ] Standing within 2 m of an item and facing it shows a prompt naming it
- [ ] E picks it up, the item disappears, and its HUD icon lights up
- [ ] Talking to the coach without all three shows "Get ready first!"

### 4. `feature/question-ui` — the quiz, reused

Copy `questions.js`, `i18n.js` and `run.js` from the 2D repo. HTML question panel over the frozen
3D world, shuffled answers, countdown bar, reveal on wrong, mouse released while it is open.

- [ ] Reaching the coach with the kit asks question 1 with a 20 s countdown
- [ ] Georgian by default, English when chosen
- [ ] Wrong or timeout reveals the correct answer, then game over

### 5. `feature/tunnel-and-pitch` — out into the stadium

Scripted walk out of the tunnel with the camera following the player, a substitution board with the
player's name, receive the ball, then the three opponents with questions 2–4, ending in GOAL,
tackled or saved. Countdowns 15 s, 12 s, 10 s.

- [ ] The walk out plays by itself and the crowd gets louder
- [ ] Beating an opponent moves you to the next; a wrong answer or timeout ends the run
- [ ] A correct 4th answer scores and stops the timer

### 6. `feature/registration-and-result` — the full loop

Copy `leaderboard.js`. HTML registration form (username, mobile, e-mail, with the 2D validation
rules) and a result screen with the top 10, Play again, 15 s auto-return, and the admin shortcuts.

- [ ] A complete run can be played start to finish and appears on the leaderboard
- [ ] Every attempt, scored or not, is saved as `{ name, phone, email, timeMs, stageReached, scored, date }`
- [ ] Play again restarts for the same player
- [ ] Ctrl+Shift+E exports every attempt with contact details; Ctrl+Shift+X resets after confirmation

### 7. `feature/audio` — the 2D sounds in 3D

Copy the `.wav` files. Footsteps, pickups, correct and wrong, whistle, tackle, save, goal, the crowd
as positional audio at the tunnel mouth, and the dressing-room music loop.

- [ ] Every event that had a sound in the 2D game has it here
- [ ] The crowd gets louder as you approach the tunnel mouth

**→ At this point the game is fully playable. Everything below is graphics and packaging.**

### 8. `feature/characters` — real people

One rigged CC0 human model reused for the player, coach, defenders and keeper, with kit colours set
by material and the clips listed in §9. Replaces every capsule.

- [ ] The player is a person in Dinamo blue and white who idles, walks, jogs and kicks
- [ ] The coach, defenders and keeper are people, not capsules, and they animate
- [ ] Still 60 fps with four characters on screen

### 9. `feature/models` — dress the world

Replace the blockout boxes with `.glb` rooms and props from CC0 kits, with PBR textures.

- [ ] No untextured grey boxes remain
- [ ] Collision boxes still match the visible walls and furniture

### 10. `feature/lighting` — make it look good

Baked lightmaps for static geometry, one sun through the tunnel, warm interior lights, soft shadows,
a little bloom, and a colour grade.

- [ ] Rooms read as lit spaces with believable shadows
- [ ] The tunnel exit is a bright, inviting target
- [ ] Still 60 fps on the stand laptop

### 11. `feature/stand-mode` — kiosk and downloads

Fullscreen on Start, no right-click, pixel-ratio cap, offline check. Copy `electron/main.cjs` and
`release.yml` from the 2D repo so GitHub Actions builds the Mac and Windows apps and publishes them
on the Releases page.

- [ ] Start enters fullscreen and a full run works with no internet
- [ ] A tagged build publishes downloadable Mac and Windows files

---

## Open questions for the developer

1. Is a ~3 minute run acceptable, given walking in 3D is slower than the top-down maze? The
   dressing room is sized for 40–70 s so the total should stay close to 3 minutes.
2. Opponent kit colours: a specific rival club, or a neutral red?
