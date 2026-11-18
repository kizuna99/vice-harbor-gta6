[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena

An original top-down open-world crime caper that runs entirely in the browser. You are Rio, running six story jobs for your Auntie Bea across the sun-baked port city of Port Serena — while the Serena Police Department (SPD) scales from a single curious cruiser to a five-star citywide manhunt with a helicopter. Everything on screen is procedural Canvas 2D and every sound is synthesized Web Audio: no art assets, no audio files, no libraries, no network requests.

## The four screenshots

1. **1-cover.jpg — Golden-hour Palm Row.** Rio drives a Palma Sedan at dusk with the first job ("First Run for Bea") on the mission panel, the live minimap in the corner, lit windows and neon starting to glow. This is the game's everyday face: traffic, palms, and a delivery to make.
2. **2-chase.jpg — Five-star night pursuit.** Full SPD pressure after dark: cruisers with flashing lightbars front and back, the helicopter overhead throwing its searchlight cone, headlight beams cutting the night. Heat only decays while no unit can see you, so this is the moment to break line of sight.
3. **3-mission.jpg — Beach Money, on foot.** The Boardwalk cash-collection job played on foot: objective ring and light pillar ahead, distance readout ticking down, the edge arrow ready if the target leaves the screen. Fists only — there are no firearms in Port Serena.
4. **4-finale.jpg — Serena Send-Off.** The final job at night: a Dockmaster Truck on Ocean Drive heading for Pier Nine with three stars already lit and a cruiser in the mirror. Make the pier and the story closes; get caught and Harbor Clinic takes its 10%.

## Features

- **A real little city:** six districts (Old Town, Palm Row, University Quarter, Serena Marina, Boardwalk, Port Docks), a road grid plus Ocean Drive, a beach and ocean, a pier, a causeway islet, named buildings, palms and props — all generated from a seed.
- **Living traffic and crowds:** cars route intersection-to-intersection, brake for the vehicle ahead and turn at junctions; pedestrians stroll, flee from trouble, and the driver of a stolen moving car bails out and runs.
- **Six playable story jobs in sequence:** a delivery run, a five-checkpoint dusk street race, stealing a marked Solano GT, ferrying singer Lulu Mar to the Marina against the clock, three on-foot Boardwalk cash collections, and a dock-to-pier getaway. Cash and respect rewards, autosave after every job.
- **A wanted system with teeth:** 1–5 stars scale police cars, foot officers, pursuit speed and aggression; an arrest meter fills when officers close in on a slow or on-foot Rio; the helicopter joins at 3 stars and keeps you "seen"; heat decays only while hidden.
- **Day–night cycle:** a full clock drives lit windows, neon signs, headlight cones and the helicopter searchlight; one job deliberately forces dusk.
- **Synthesized sound:** engine hum that tracks speed, two-tone sirens that swell with police proximity, three procedural radio stations, and one-shot effects for punches, crashes, pickups and job success.
- **HUD and navigation:** wanted stars, cash, respect, health, speedometer, current job with timer and objective distance, a live minimap (traffic, police, helicopter, objective), an off-screen objective edge arrow, and a district banner when you cross into a new neighbourhood.
- **Saves:** progress (cash, respect, job index, position, clock, stats) persists in localStorage; CONTINUE resumes from the title screen.
- **Performance:** fixed-timestep 1/60 simulation with a clamped frame delta, pooled particles (cap ~240) and skidmarks (cap ~300), viewport-culled drawing — a steady 60 FPS in headless Chromium playtests.

## Play it from zero

```sh
node serve.ts
```

Then open http://localhost:8080 and press **PLAY NOW** (or CONTINUE if you have a save). That is the whole install: Node is the only requirement.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Arrow keys | Walk / drive (steer + throttle) |
| Shift | Sprint on foot |
| E / F / Enter | Enter or exit a car |
| Space | Brake / handbrake |
| J / Mouse click | Punch (on foot) |
| H | Horn |
| N | Cycle radio station |
| R | Reset to the nearest road |
| P / Esc | Pause |
| M | Mute |
| Touch buttons | On-screen drive/action pad, appears after the first touch |

## Honest limits

- **Melee only.** There are no firearms, for Rio or the SPD; police pressure comes from numbers, pursuit driving and the arrest meter.
- **2D top-down.** Buildings are flat-shaded rectangles with window grids, not 3D models; the charm is in the systems, not the geometry.
- **Timed jobs reset their step on timeout.** Running out of time on Neon Rush or the VIP run restarts that job's current step rather than failing the whole story — your completed jobs and earnings are never taken away.
- Busted and Wasted both end at Harbor Clinic, which charges 10% of the cash you are carrying. That fee is the entire death penalty.

## File layout

- `main.ts` — the hand-in program: stages `game/` and `screenshots/` into the output directory and writes `dossier.json`.
- `serve.ts` — zero-dependency static server for local play on port 8080.
- `shots.json` — the four staged screenshot scenes and their URL queries.
- `game/index.html` — page shell, canvas and touch controls.
- `game/src/` — the game itself, in plain ES modules: `config.js` (tuning), `random.js` (seeded RNG), `world.js` (city generation), `input.js`, `entities.js` (traffic, pedestrians), `police.js` (SPD), `combat.js` (melee, BUSTED/WASTED), `missions.js` (the six jobs), `audio.js` (synthesized sound), `game.js` (simulation core), `render.js` (Canvas renderer + HUD), `shots.js` (staged scenes), `main.js` (boot + loop).
- `screenshots/` — the four staged captures described above.
- `vendor/makefun-game.ts` — the kit's dossier builder, used by `main.ts`.

## Originality note

Every name in this game is original: Port Serena, Vice Harbor, Rio, Auntie Bea, Lulu Mar, the Serena Police Department, and all six vehicle models (Calle Coupe, Solano GT, Palma Sedan, Harbor Taxi, Dockmaster Truck, Serena Cruiser) were invented for this entry. No commercial game's names, characters, places, art or audio are used anywhere; all graphics are drawn with Canvas primitives and all audio is synthesized at runtime.
