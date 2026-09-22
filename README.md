# Dinamo Road to Goal 3D

Third-person 3D remake of the Dinamo Tbilisi workshop stand game.
Walk the dressing room, find your kit, answer the coach, and score.

- Plan and roadmap: [`docs/SPEC.md`](docs/SPEC.md)
- 2D original: [dinamo-matchday](https://github.com/Dav1tGegesh1dze/dinamo-matchday)

## Running it

```
npm install
npm run dev
```

## Asset credits

Listed for reference. Everything is CC0 (public domain) unless noted:

- `public/assets/models/footballer.glb`: Quaternius, *Universal Base Characters* (Superhero male, light skin) with the *Buzzed* hairstyle merged in; the body is split offline into kit parts (Shirt, Sleeves, Shorts, Legs, Socks, Boots) and the cloth loosened ([quaternius.com](https://quaternius.com/packs/universalbasecharacters.html))
- `public/assets/models/animations.glb`: Quaternius, *Universal Animation Library*, the 10 clips the game plays ([quaternius.com](https://quaternius.com/packs/universalanimationlibrary.html))
- `public/assets/icons/*.png`, `public/assets/audio/*.wav`: from the 2D game `dinamo-matchday`
- `public/assets/textures/grass.jpg`: ambientCG, *Grass 005* ([ambientcg.com](https://ambientcg.com/view?id=Grass005)), resized to 512 px
- `public/assets/textures/seats.png`, `boards.png`: drawn for this project; the board lettering uses Noto Sans and Noto Sans Georgian (SIL Open Font License)
- `public/assets/models/tape.glb`: Poly Haven, *Medical Tape* ([polyhaven.com](https://polyhaven.com/a/medical_tape)), converted to `.glb` with 512 px WebP textures
- `public/assets/textures/floor-tiles.jpg`, `shower-tiles.jpg`, `ceiling.jpg`, `wood.jpg`: ambientCG *Tiles 140*, *Tiles 133 A*, *Office Ceiling 003*, *Wood 095*, resized to 512 px
- `public/assets/textures/walls.jpg`: ambientCG *Painted Plaster 017* with the Dinamo-blue band added; `signs.png`: drawn for this project (Noto fonts, SIL Open Font License)
- `public/assets/models/chalkboard.glb`, `crate.glb`, `shelves.glb`, `wet-floor-sign.glb`: Poly Haven *Standing Chalkboard 01*, *Plastic Crate 01*, *Steel Frame Shelves 01*, *Wet Floor Sign 01*, converted to `.glb` with 512 px WebP textures
- `public/assets/textures/tunnel-wall.png`, `rubber.png`: drawn for this project (Noto fonts, SIL Open Font License)
- `public/assets/env/studio.hdr`: Poly Haven, *Brown Photostudio 02* HDRI ([polyhaven.com](https://polyhaven.com/a/brown_photostudio_02)), 1k
