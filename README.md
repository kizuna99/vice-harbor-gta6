[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena

An original top-down open-world crime caper that runs entirely in the browser. You are **Rio**, a small-time runner in the sun-bleached port city of Port Serena, working eight jobs for fixer **Auntie Bea** while the Serena Police Department (SPD) does its best to ruin your week. Everything on screen is drawn procedurally on an HTML5 canvas and every sound is synthesized live with the Web Audio API — there are no image files, no audio files, no libraries and no network requests.

## Screenshots

- **`screenshots/1-cover.jpg` — Palm Row at golden hour.** Rio cruises Palm Row in traffic with the job panel, wanted HUD and live minimap on screen; the first delivery for Bea is already ticking.
- **`screenshots/2-chase.jpg` — Five-star night pursuit.** A stolen Solano GT downtown at night: SPD cruisers with flashing lightbars converge while the police helicopter paints Rio with its searchlight.
- **`screenshots/3-mission.jpg` — Beach Money, on foot.** Mid-collection on the Boardwalk: the objective light pillar, the on-screen distance readout and the minimap marker show exactly where the next cash drop waits.
- **`screenshots/4-finale.jpg` — Serena Send-Off.** The last job of the book: a Dockmaster Truck hammering down Ocean Drive at night under three stars, timed, with Pier Nine as the getaway target.

## What is in the city

- **Six districts plus the shore, one continuous map (3200×2400):** Old Town, the University Quarter, Serena Marina, Palm Row, Downtown, Midtown, the Port Docks and the Boardwalk — with a beach, open water, a wooden pier (Pier Nine), seeded rooftops, sun-arc shadows and neon that reflects on wet streets after dark.
- **Six drivable vehicles** with distinct handling: Calle Coupe, Solano GT, Palma Sedan, Harbor Taxi, Dockmaster Truck and the SPD's own Serena Cruiser.
- **Living traffic and crowds:** cars hold right-hand lanes on the avenue grid, brake for each other, honk, stop for pedestrians in the paint and turn at intersections; pedestrians stroll, panic and flee gunfire.
- **A real wanted system, 1–5 stars:** one heat score under five thresholds. Cruisers and foot officers scale with your stars, a helicopter with a sweeping searchlight joins at three, roadblocks replace the chase at four, an arrest meter fills when officers pin a slow Rio — and heat only decays while nobody in uniform can see you.
- **An arsenal, bought not found:** the Harbor Pistol ($180), Calle SMG, Dockside Shotgun and grenades from **Serena Munitions**, with magazines, reserves, Q reloads, pellet spread, a 0.75-second grenade fuse, chain-exploding cars and a Kevlar vest that soaks 65% of every hit.
- **Serena Customs:** engine tunes, armour plating, nitro, resprays and repairs for whatever you are driving.
- **Eight jobs in sequence:** a first delivery for Bea, the five-checkpoint Neon Rush, stealing the marked Solano GT, ferrying singer Lulu Mar against the clock, three Boardwalk collections, the dock getaway — then **Dockside Crossfire**, a three-wave shootout against the Ferro crew for a strongbox, and **Searchlight Run**, a 170-second escape at a locked four stars that only the Old Town safehouse can end.
- **Street racing:** the Palm Row Sprint ($400) and the Harbor Lights Run ($650), each eight checkpoints against two rubber-banding house rivals — Vex's teal coupe and Mara's red sedan.
- **A crew of your own:** Vex the mechanic (respect 30) and Mara the smuggler (respect 70) can be recruited at the safehouse. They follow in formation, ride along, shoot alongside you, go down, and get revived.
- **Three radio stations, all synthesized:** Serena Sun FM (a bright synth arpeggio), Harbor Wave Radio (a driving rock loop) and Night Pier 88 (static and low talk), plus an engine note tied to speed and a siren that swells as the law closes in.
- **Day–night cycle, stunt ramps, BUSTED and WASTED endings,** and full persistence: cash, respect, weapons, armour, mods, job progress, crew and position autosave to `localStorage`.

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
| Shift | Sprint on foot / nitro with the kit fitted |
| E | Enter or exit a car · open a shop · recruit at the safehouse |
| Space | Brake (in a car) |
| J / Mouse click | Punch, fire, throw — or start a race at a start marker |
| Q | Reload |
| 1–5 | Weapon slots: pistol, SMG, shotgun, grenade, fists |
| 1–8 | Buy, while a shop panel is open |
| C | Crew: follow me / hold position |
| H | Horn |
| N | Next radio station (while driving) |
| M | Mute / unmute |
| R | Reset to the safehouse corner |
| P / Esc | Pause |

## Honest limits

- The world is 2D top-down canvas; there is no 3D and no multiplayer.
- Timed job steps reset that step (not the whole job) when the clock runs out.
- Saves live in the browser's `localStorage` only.

## File layout

```
main.ts            hand-in program: copies game/ + screenshots/, writes dossier.json
serve.ts           dependency-free dev server for game/ on :8080
shots.json         the four staged screenshot scenes (?shot=...&seed=7)
game/index.html    page shell, canvas and touch controls
game/src/config.js     tuning: world, districts, vehicles, wanted, prices
game/src/random.js     seeded RNG and math helpers
game/src/world.js      Port Serena layout: roads, buildings, beach, pier, collisions, line-of-sight
game/src/input.js      keyboard, mouse and touch input with per-tick edge draining
game/src/entities.js   traffic AI, pedestrians, player and vehicle physics
game/src/police.js     wanted heat, SPD pursuit, officers, helicopter, roadblocks, arrest
game/src/combat.js     the Dockside gunmen: bursts, strafing, wall-checked line-of-sight
game/src/weapons.js    arsenal, projectiles, grenades, explosions
game/src/missions.js   Auntie Bea's eight jobs
game/src/races.js      the two street races and their rubber-band rivals
game/src/crew.js       Vex and Mara: recruit, follow, ride, fight, revive
game/src/audio.js      Web Audio engine, sirens, effects and the three radio stations
game/src/game.js       fixed-step simulation, shops, camera, particles, saves
game/src/render.js     canvas renderer: 2.5D city, HUD, minimap, title and end screens
game/src/shots.js      deterministic staged scenes for the screenshots
game/src/main.js       boot, frame loop, window.ViceHarbor debug handle
vendor/                the make.fun hand-in library (unmodified)
```

## Originality note

Vice Harbor — Port Serena is an original work: the city, districts, characters (Rio, Auntie Bea, Lulu Mar, Vex, Mara, the Ferro crew), vehicle names, radio stations and the Serena Police Department were invented for this entry. It shares only the broad, unprotectable idea of a top-down open-world driving game with the genre's classics, and uses no names, art, audio, maps or other assets from any commercial game.
