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
| Run length | **About 3 minutes is fine** |
| Kits | **Player: Dinamo home kit** (blue shirt, blue shorts, blue-and-white socks). Defenders: plain red (a fictional rival, no real club's kit). Goalkeeper: green |
| Player look | **A real footballer from the start**, not a capsule (moved up to roadmap item 2) |
| Stadium | **Must look like Dinamo Tbilisi's home ground, the Boris Paichadze Dinamo Arena** (§10) |

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
- Result screen: the top 10 with the current player highlighted, Restart (button or Enter) back to
  registration for the next player,
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
electron/main.cjs    # copied from the 2D game (roadmap item 16)
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
    player.js        # capsule collider, gravity, movement relative to the camera
    camera.js        # third-person follow camera, mouse orbit, wall pull-in
    character.js     # a rigged model, its kit colours and its animation clips (player, coach, opponents)
    stadium.js       # the Dinamo Arena bowl, built from its real dimensions (§10)
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
- Moving is a **jog at 3 m/s**; Shift **sprints at 5 m/s**, like GTA. Space and jumping are not used.
- Standing still plays `Idle`; moving plays `Run`, sped up for the sprint so the feet don't slide,
  with a 0.25 s cross-fade between them. The model's `Walk` clip only matches about 1.3 m/s, so
  the player never uses it.

**Pointer lock.** Browsers only allow it after a click, so the dressing room opens with a
"Click to start" overlay. Escape releases the mouse and pauses; clicking resumes.

**Why not first person:** the developer chose GTA-style. Seeing your own Dinamo player also pays
off in the tunnel walk and the shot on goal. The cost is a rigged player model with animations
(roadmap item 2) and the camera wall pull-in above.

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

**Two things look right from the start**, because the developer asked for them: your player is a
real footballer in the Dinamo kit (roadmap item 2), and the stadium is recognisably the Dinamo Arena
(roadmap item 6).

**Stage 1 — blockout (roadmap items 1–9).** Rooms built from boxes with flat colours, and the coach
and opponents as capsules with a coloured top. Ugly, but fully playable at the correct sizes and
layout. Every later improvement replaces assets, not code.

**Stage 2 — dressed (roadmap items 11–14).** Real kit items, a club dressing room and tunnel
(tiled floor, painted walls, ceilings with strip lights, lockers, benches, a physio bed, showers)
from CC0 textures and Poly Haven props, and proper duels on the pitch. See Phase 2 in the roadmap.

**Stage 3 — lit (roadmap item 15).** One directional "sun" through the tunnel mouth, warm ceiling
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

**Characters** come from Quaternius's **Animated Men Pack** (CC0, from poly.pizza). All its models
share one skeleton and the clips `Idle`, `Walk`, `Run`, `Jump`, `Clapping`, `Standing` and a few
others. Materials are plain colours named `Shirt`, `Pants`, `Socks`, `Skin`, `Hair`, so a kit is a
colour swap, not a new texture:
- **Player:** the pack's man in T-shirt and shorts (`footballer.glb`), in the Dinamo home kit: blue
  shirt, blue shorts, white socks. Clips: `Idle` and `Run` (jog and sprint).
- **Defenders:** the same footballer in plain red. **Goalkeeper:** the same footballer in green.
- **Coach:** the pack's man in a suit (`coach.glb`). Clips: `Idle`, `Clapping`.

The pack has no kick, tackle or dive, so the duels (roadmap item 14) are built from its clips:
`Sitting` tipped back and slid along the grass is the sliding tackle, `RunningJump` hurdles it,
`Death` is the player going down, and `Jump` celebrates.

**Honest expectation:** "GTA-like" describes the camera and the feeling of walking through a real
space. It does not mean GTA's art budget. With free assets and baked lighting this can look like a
clean, modern indie game. Photorealistic players and stadium crowds are out of scope; the crowd is
sound plus a simple stand texture.

---

## 10. The stadium: Boris Paichadze Dinamo Arena

Walking out of the tunnel must feel like walking out at Dinamo Tbilisi's home ground.

**Known facts** (Wikipedia, StadiumDB):
- An elliptical bowl, rebuilt 1969–1976, about 54,000 seats since the 2006 refurbishment.
- Two tiers, with an evacuation terrace (a walkway ring) between them.
- A 30 m deep cantilevered roof covering most of the upper tier, all the way round.
- The roof and upper tier are carried by 58 pylons around the outside.
- Pitch 105 × 68 m, natural grass. Because the bowl is oval and the pitch is rectangular, there is a
  wide apron between the touchlines and the first row, widest behind the goals.

**Assumptions to confirm with the developer** (not in any source found): blue seats, and
floodlights mounted along the front edge of the roof.

**How it is built.** No free model of the Dinamo Arena exists, so `world/stadium.js` builds it from
the numbers above: the pitch, the apron, a lower tier, the terrace ring, an upper tier, the roof ring
and the pylons, each as an elliptical ring. Approximate sizes: first row on an ellipse of about
150 × 110 m, lower tier rising to about 12 m, terrace about 3 m wide, upper tier rising to about
30 m, roof 30 m deep. **Every surface's look comes from texture files** in `public/assets/textures/`
(grass stripes, seat rows with a crowd, concrete, roof panels, the advertising boards). This is the
one exception to "models come from files" in `CLAUDE.md`.

**Details that sell it:**
- Advertising boards around the pitch saying `DINAMO TBILISI` in blue and white.
- The tunnel comes out on the halfway line of the main stand.
- The camera follows the player out, so the bowl rises around you as you leave the tunnel.

**Honest expectation:** recognisably the Dinamo Arena's shape and colours: an oval two-tier bowl
under a ring roof. Not a photographic replica.

---

## 11. Performance budget (stand laptop, integrated graphics)

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

## 12. Audio

The 2D game's sound files are reused. Footsteps, pickups, the crowd and the stings stay the same,
played through Three.js's audio classes. Footsteps are timed to the walk and jog animations. New:
`THREE.PositionalAudio` makes the crowd get louder towards the tunnel mouth, which sells the walk
out.

---

## 13. Offline and stand behaviour

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

- [x] `npm run dev` opens a 3D room with a capsule player seen from behind; `npm run build` passes
- [x] Clicking locks the mouse; moving the mouse orbits the camera; WASD moves relative to the camera; Escape releases
- [x] The player cannot walk through walls or fall through the floor
- [x] Backing the camera into a wall pulls it in front of the wall instead of showing through it
- [x] Frame rate stays at 60 fps

### 2. `feature/player-character` — a real footballer in the Dinamo kit

Replace the capsule with the Animated Men Pack footballer (§9), loaded as a `.glb` through
`loader.js`, coloured in the Dinamo home kit, with `Idle` and `Run` cross-faded.

- [ ] The player is a person in a blue shirt, blue shorts and white socks, not a capsule
- [ ] Standing still plays idle, moving plays run (faster when sprinting), and changes blend smoothly
- [ ] Collision and the camera behave exactly as before
- [ ] Still 60 fps

### 3. `feature/dressing-room` — the real layout in blockout

Dressing room, corridor, physio room, showers and tunnel mouth at true scale, with corridors and
doorways at least 2.5 m wide, laid out so a first-time player needs 40–70 s. Doorways, no ceilings
yet. The layout is the 2D game's map at 1.25 m per tile, written as an ASCII grid in
`dressingRoom.js`. The 2D game's winding tunnel loop is walled off, and the coach stands in the
alcove at its entrance (the tunnel mouth), because in 3D the tunnel is the scripted walk that
follows. Shortest route spawn → shirt → boots → tape → coach: 131 m, 42 s at a jog.

- [ ] All five spaces exist and connect as described
- [ ] A first run through takes 40–70 s
- [ ] Nowhere can the player get stuck, and the camera never ends up inside a wall

### 4. `feature/interaction` — pick up your kit

Proximity prompts, E to pick up. Shirt and boots in the dressing room, tape in the physio room. HUD
icons light up (the 2D game's `shirt.png`, `boots.png`, `tape.png`). The coach refuses until all
three are held. The coach is already the Animated Men Pack's suited man (`coach.glb`), since he
costs no more than a capsule; the kit items are blockout placeholders in `loader.js`.

- [ ] Standing within 2 m of an item and facing it shows a prompt naming it
- [ ] E picks it up, the item disappears, and its HUD icon lights up
- [ ] Talking to the coach without all three shows "Get ready first!"

### 5. `feature/question-ui` — the quiz, reused

Copy `questions.js` and `run.js` from the 2D repo (`i18n.js` came in item 1). HTML question panel
over the frozen 3D world, shuffled answers, countdown bar, reveal on wrong, mouse released while it is open.
Same timings as the 2D game: 0.6 s to confirm a right answer, 1.5 s to show the right one after a
wrong answer or timeout. Until the result screen exists (item 8), game over is the red "Stay on the
bench" message.

- [ ] Reaching the coach with the kit asks question 1 with a 20 s countdown
- [ ] Georgian by default, English when chosen
- [ ] Wrong or timeout reveals the correct answer, then game over

### 6. `feature/stadium` — out into the Dinamo Arena

The Dinamo Arena from §10, with its textures. Scripted walk out of the tunnel with the camera
following the player, a substitution board with the player's name, and the ball arriving at the
player's feet.
Walk-out timeline (`stages/tunnel.js`): walk 12 m out of the tunnel at 1.3 m/s, walk to the fourth
official (in black) at the halfway line, wait 2.5 s while his board shows `▲ <name>` (HTML drawn
over the 3D board), jog to the centre circle at 3 m/s, and a team-mate's pass rolls to the
player's feet as he turns to face the goal at +x. The mouse still orbits the camera; left alone
it drifts back behind the player. The ball and goals are blockout placeholders in `loader.js`
(no CC0 football model was found yet).

- [ ] Walking out shows an oval two-tier bowl under a ring roof, with blue seats, a striped pitch and `DINAMO TBILISI` boards
- [ ] The walk out plays by itself after question 1 is answered correctly
- [ ] The substitution board shows the registered name
- [ ] Still 60 fps with the whole bowl in view

### 7. `feature/pitch` — beat the defenders and the keeper

The three opponents with questions 2–4, ending in GOAL, tackled or saved. Countdowns 15 s, 12 s,
10 s. The player dribbles automatically (3 m/s, ball rolling ahead) up to 3.5 m from each
defender and to the penalty spot for the keeper. Right: he goes round the defender, or shoots into
the top corner while the keeper dives the other way. Wrong or timeout: the defender runs in and
pokes the ball away, or the keeper catches it. Clicking an answer re-locks the mouse (the browser
allows it during a click), so play continues without another "Click to play"; after a timeout the
player clicks once. The pitch stage shares the scene the tunnel stage built.

- [ ] Beating an opponent moves you to the next; a wrong answer or timeout ends the run
- [ ] A correct 4th answer scores and stops the timer

### 8. `feature/registration-and-result` — the full loop

Copy `leaderboard.js`. HTML registration form (username, mobile, e-mail, with the 2D validation
rules) and a result screen with the top 10, Play again, 15 s auto-return, and the admin shortcuts. The
HUD gains the run timer. Start and Play again are clicks (or Enter), so they lock the mouse at once.
Every run builds fresh stage scenes. After "GOAL!", "Tackled!", "Saved!" or "Stay on the bench"
the result follows 2.5 s later.

- [ ] A complete run can be played start to finish and appears on the leaderboard
- [ ] Every attempt, scored or not, is saved as `{ name, phone, email, timeMs, stageReached, scored, date }`
- [x] Play again restarts for the same player (replaced in item 10: Restart goes to registration)
- [ ] Ctrl+Shift+E exports every attempt with contact details; Ctrl+Shift+X resets after confirmation

### 9. `feature/audio` — the 2D sounds in 3D

Copy the `.wav` files. Footsteps, pickups, correct and wrong, whistle, tackle, save, goal, the crowd
as positional audio at the tunnel mouth, and the dressing-room music loop. Footsteps play every 1.5 m jogged
(one stride of the Run clip). In the dressing room the crowd comes from the coach at the tunnel mouth
(full volume within 3 m, fading with distance); in the walk out it swells from 0.15 in the tunnel to
0.5 on the pitch and plays until the result. Stages stop their sounds in `exit()`.

- [ ] Every event that had a sound in the 2D game has it here
- [ ] The crowd gets louder as you approach the tunnel mouth

**→ At this point the game is fully playable. Everything below is graphics and packaging.**

## Phase 2: the developer's feedback after playing (items 10–14)

The developer played the full game and asked for:
1. **Kit you actually put on.** Start in training clothes; the items must look like real football
   things; picking one up changes what the player wears.
2. **A proper duel with each opponent.** The defender runs in and slides in for the tackle; a right
   answer jumps it and carries on, a wrong one ends with the player on the grass.
3. **Restart, win or lose, back to the registration screen** for the next player, not the same
   player again. (No password: registration is name, mobile and e-mail as in the 2D game. There
   are no accounts, and a browser cannot keep passwords safely on a shared stand.)
4. **A dressing room and tunnel that look like a real stadium's**, not grey blocks.

**What the assets allow** (checked): Poly Haven (CC0, realistic) has a football, medical tape,
fluorescent ceiling lights, a wooden bench, a chalkboard, shelves, crates, a wet-floor sign and bins,
but no lockers, football shirts or boots. The footballer model's own shirt, shown on its own, is a
real football shirt shape, and its shoes can be split off as a pair of boots, so those come from the
character file itself. Lockers are part of the room architecture (wood-textured cubicles). Poly
Haven models are converted offline to `.glb` with 512 px WebP textures (about 0.3 MB each).

### 10. `feature/restart` — the next player

The result screen's button becomes **Restart** (Enter too), for a win or a loss: it goes to the
registration screen with empty fields, the same place the 15 s auto-return goes.

- [x] After a goal and after a loss, Restart shows an empty registration form
- [x] Enter on the result screen does the same

### 11. `feature/wear-kit` — kit you put on

The player starts in a grey training T-shirt, black shorts, dark socks and white trainers. The items:
the Dinamo shirt hanging in the player's locker (the footballer model's own shirt), the boots on the
bench (its shoes, split into their own `Shoes` material offline), and Poly Haven's medical tape on
the physio bed. Picking up the shirt dresses him in the blue shirt and shorts, the boots swap the
trainers for black boots, and the tape shows as white tape round his ankles.

- [x] He starts in training clothes and each pickup visibly changes what he wears
- [x] The shirt, boots and tape look like the real things, not blocks

### 12. `feature/real-dressing-room` — a club dressing room

Textures from ambientCG (tiled floor, painted walls with a Dinamo-blue band, ceiling tiles) and
ceilings at 3 m with Poly Haven fluorescent lights. The dressing room gets lockers round the walls
with a Dinamo shirt in each and a bench in front, a tactics chalkboard and a crate of footballs; the
physio room a treatment bed; the showers wall tiles and a wet-floor sign; bins and shelves in the
corridors. Collision boxes cover the furniture.

- [x] No grey blockout boxes remain in the dressing-room stage
- [x] Every room is recognisable (dressing room, physio, showers, corridor, tunnel mouth)
- [x] Collision matches the furniture, nobody gets stuck, the camera stays under the ceiling
- [x] Still 60 fps

### 13. `feature/real-tunnel` — the players' tunnel

The stadium tunnel in concrete with Dinamo-blue panels, the club name and crest, ceiling lights
and a floor mat, opening onto the bright pitch; the dressing room's tunnel mouth matches it.

- [x] The walk out starts in a lit, branded tunnel and ends in daylight
- [x] Still 60 fps

### 14. `feature/pitch-duels` — defenders tackle, the keeper dives

Each defender runs at the player and slides in (the `Sitting` pose tipped back and slid along the
grass). The question appears as he slides. Right: the player hurdles the tackle (`RunningJump`)
and carries on. Wrong: the tackle takes the ball and the player goes down (`Death`, the fall). The
keeper dives the wrong way on a goal and the right way on a save; the player celebrates a goal
(`Jump`). The football becomes Poly Haven's football model.

- [ ] Each defender runs in and slides; a right answer hurdles him, a wrong one floors the player
- [ ] The keeper dives on every shot; a goal is celebrated
- [ ] Still 60 fps with four characters on screen

### 15. `feature/lighting` — make it look good

Baked lightmaps for static geometry, one sun through the tunnel, warm interior lights, soft shadows,
a little bloom, and a colour grade.

- [ ] Rooms read as lit spaces with believable shadows
- [ ] The tunnel exit is a bright, inviting target
- [ ] Still 60 fps on the stand laptop

### 16. `feature/stand-mode` — kiosk and downloads

Fullscreen on Start, no right-click, pixel-ratio cap, offline check. Copy `electron/main.cjs` and
`release.yml` from the 2D repo so GitHub Actions builds the Mac and Windows apps and publishes them
on the Releases page.

- [ ] Start enters fullscreen and a full run works with no internet
- [ ] A tagged build publishes downloadable Mac and Windows files

