[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena

An original top-down open-world crime caper that runs entirely in the browser. You are **Rio**, a small-time runner in the sun-bleached port city of Port Serena, working six jobs for fixer **Auntie Bea** while the Serena Police Department (SPD) does its best to ruin your week. Everything on screen is drawn procedurally on an HTML5 canvas and every sound is synthesized live with the Web Audio API — there are no image files, no audio files, no libraries and no network requests.

## Screenshots

- **`screenshots/1-cover.jpg` — Palm Row at golden hour.** Rio cruises Palm Row in traffic with the job panel, wanted HUD and live minimap on screen; the first delivery for Bea is already ticking.
- **`screenshots/2-chase.jpg` — Five-star night pursuit.** A stolen Solano GT downtown at night: SPD cruisers with flashing lightbars converge while the police helicopter paints Rio with its searchlight.
- **`screenshots/3-mission.jpg` — Beach Money, on foot.** Mid-collection on the Boardwalk: the objective light pillar, the on-screen distance readout and the minimap marker show exactly where the next cash drop waits.
- **`screenshots/4-finale.jpg` — Serena Send-Off.** The last job: a Dockmaster Truck hammering down Ocean Drive at night under three stars, timed, with Pier Nine as the getaway target.

## What is in the city

- **Six districts, one continuous map (3200×2400):** Old Town, Palm Row, University Quarter, Serena Marina, the Boardwalk and the Port Docks, plus a beach, open ocean, a causeway islet and Pier Nine.
- **Six drivable vehicles** with distinct handling: Calle Coupe, Solano GT, Palma Sedan, Harbor Taxi, Dockmaster Truck and the SPD's Serena Cruiser.
- **Living traffic and crowds:** cars follow the avenue grid in right-hand lanes, brake for each other, honk and turn at intersections; pedestrians stroll, panic, flee and fall.
- **A real wanted system, 1–5 stars:** heat rises with punches, thefts and collisions; cruisers and foot officers scale with your stars, a helicopter with a sweeping searchlight joins at three stars, an arrest meter fills when officers pin a slow Rio — and heat only decays while nobody in uniform can see you.
- **Six jobs in sequence:** a first delivery for Bea, the five-checkpoint Neon Rush at dusk, stealing the marked Solano GT, ferrying singer Lulu Mar to the Marina against the clock, three on-foot Boardwalk collections, and the dock-to-Pier-Nine getaway.
- **Day–night cycle:** lit windows, neon signage, street-lamp pools and headlight cones after dark; golden-hour light in the evening.
- **Synthesized audio:** engine hum tied to speed, proximity sirens, and three radio stations (Serena Sun FM, Harbor Wave Radio, Night Pier 88) — all oscillators, zero audio assets.
- **Persistence:** cash, respect, job progress, time of day and position autosave to `localStorage`; the title screen offers PLAY NOW and CONTINUE.
- **BUSTED and WASTED endings:** fines at the SPD desk, or a Harbor Clinic bill of 10% of your cash.

## Play it from zero

Requires Node 22 (or any static file server):

```sh
node serve.ts
```

Then open **http://localhost:8080** in a desktop browser and press **PLAY NOW**.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Arrow keys | Walk, or drive (accelerate / reverse / steer) |
| Shift | Sprint on foot |
| E / F / Enter | Enter or exit the nearest car |
| Space | Brake (in a car) |
| J / Mouse click | Punch |
| H | Horn |
| N | Next radio station (while driving) |
| M | Mute / unmute |
| R | Reset to Bea's corner |
| P / Esc | Pause |
| Touch buttons | On-screen pad appears after the first touch: drive, act (E), punch, brake |

## Honest limits

- Combat is melee only — fists, no firearms.
- The world is 2D top-down canvas; there is no 3D and no multiplayer.
- Timed job steps reset that step (not the whole job) when the clock runs out.
- Saves live in the browser's `localStorage` only.

## File layout

```
main.ts            hand-in program: copies game/ + screenshots/, writes dossier.json
serve.ts           dependency-free dev server for game/ on :8080
shots.json         the four staged screenshot scenes (?shot=...&seed=7)
game/index.html    page shell, canvas and touch controls
game/src/config.js     tuning: world, districts, vehicles, wanted, rewards
game/src/random.js     seeded RNG and math helpers
game/src/world.js      Port Serena layout: roads, buildings, beach, pier, collisions
game/src/input.js      keyboard, mouse and touch input
game/src/entities.js   traffic AI, pedestrians, player and vehicle physics
game/src/police.js     wanted heat, SPD pursuit, officers, helicopter, arrest
game/src/combat.js     punches, health, BUSTED / WASTED, clinic respawn
game/src/missions.js   Auntie Bea's six jobs
game/src/audio.js      Web Audio engine, sirens, radio and effects
game/src/game.js       fixed-step simulation, camera, particles, saves
game/src/render.js     canvas renderer, HUD, minimap, title and end screens
game/src/shots.js      deterministic staged scenes for the screenshots
game/src/main.js       boot, frame loop, window.ViceHarbor debug handle
vendor/                the make.fun hand-in library (unmodified)
```

## Originality note

Vice Harbor — Port Serena is an original work: the city, districts, characters (Rio, Auntie Bea, Lulu Mar), vehicle names, radio stations and the Serena Police Department were invented for this entry. It shares only the broad, unprotectable idea of a top-down open-world driving game with the genre's classics, and uses no names, art, audio, maps or other assets from any commercial game.
