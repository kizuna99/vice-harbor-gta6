[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena · v2

An original top-down open-world crime caper that runs entirely in the browser. You are **Rio**, a small-time runner in the sun-bleached port city of Port Serena, working eight jobs for fixer **Auntie Bea** while the Serena Police Department does its best to ruin your week. Everything is drawn procedurally on an HTML5 canvas and every sound is synthesized live with Web Audio — no image files, no audio files, no libraries, no network requests.

## Screenshots

- **`screenshots/1-cover.jpg` — Palm Row at golden hour.** Rio cruises in traffic with the job panel, wanted HUD and live minimap on screen.
- **`screenshots/2-chase.jpg` — Five-star night pursuit.** A stolen Solano GT downtown at night: SPD cruisers converge while Air One paints Rio with its searchlight.
- **`screenshots/3-mission.jpg` — Beach Money, on foot.** Mid-collection on the Boardwalk: objective pillar, distance readout and minimap marker.
- **`screenshots/4-finale.jpg` — Serena Send-Off.** A Dockmaster Truck hammering down Ocean Drive at night under three stars, Pier Nine ahead.

## What is new in v2

- **An arsenal.** Harbor Pistol, Calle SMG (full auto), Dockside Shotgun (six pellets) and grenades with a 0.75 s fuse — projectiles and tracers, magazines, Q to reload, slots 1–5, kevlar that absorbs 65% of every hit, and cars that cook off and chain-explode. Enemy gunman **Ferro** fires three-round bursts and cannot shoot through buildings.
- **Two shops.** *Serena Munitions* (600, 1000) sells weapons, ammo, health and kevlar from a numbered panel; *Serena Customs* (2200, 1400) fits an engine tune and body plating, repairs and resprays. Saves are v3 (`vice-harbor-save-v3`) and carry weapons, ammo, armor, mods and crew.
- **Two more jobs.** *Dockside Crossfire* (job 7): three waves, ten hostiles, one strongbox. *Searchlight Run* (job 8): heat locked at 170 — four stars — for up to 170 seconds; only the Old Town safehouse scrubs it.
- **Street races.** *Palm Row Sprint* ($400) and *Harbor Lights Run* ($650): press J in a car at a start marker, beat the countdown, clear eight checkpoints against two rubber-banding rivals.
- **A crew.** Vex (respect 30) and Mara (respect 70) wait at the Old Town safehouse (200, 340). They follow, ride along, shoot beside you, go down and get revived at your side; C toggles follow / stay.
- **A prettier city.** 2.5D rooftops with sun-arc shadows and seeded texture, neon reflections on the harbour, four stunt ramps, roadblocks from four stars, and a minimap that marks the shops (W / G), enemies and crew.

## The city underneath

- **Six districts, one continuous map (3200×2400):** Old Town, Palm Row, University Quarter, Serena Marina, the Boardwalk and the Port Docks, plus beach, ocean, a causeway islet and Pier Nine.
- **Six drivable vehicles:** Calle Coupe, Solano GT, Palma Sedan, Harbor Taxi, Dockmaster Truck and the SPD's Serena Cruiser.
- **Living traffic and crowds** on a right-hand avenue grid; pedestrians stroll, panic, flee and fall.
- **A real wanted system, 1–5 stars:** heat from crimes, cruisers and foot officers scaling with stars, a searchlight helicopter from three stars, roadblocks from four, an arrest meter — and heat that only decays unseen.
- **Eight jobs in sequence**, a day–night cycle, three synthesized radio stations (Serena Sun FM, Harbor Wave Radio, Night Pier 88), autosave, and BUSTED / WASTED endings.

## Play it from zero

Requires Node 22 (or any static file server):

```sh
node serve.ts
```

Then open **http://localhost:8080** in a desktop browser and press **PLAY NOW**.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Arrow keys | Walk, or drive |
| Shift | Sprint on foot |
| E / F / Enter | Interact: shop, garage, recruit, enter / exit car |
| Space | Brake (in a car) |
| J / Mouse click | Fire weapon or punch on foot · start race at a marker (in a car) |
| 1–5 | Weapon slots: pistol, SMG, shotgun, grenade, fists |
| 1–8 | Buy from a shop panel while it is open |
| Q | Reload |
| C | Crew follow / stay |
| H | Horn |
| N | Next radio station (while driving) |
| M | Mute / unmute |
| R | Reset to Bea's corner |
| P / Esc | Pause · close a shop panel |
| Touch buttons | On-screen pad after the first touch |

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
game/src/config.js     tuning: world, districts, vehicles, wanted, shop anchors, rewards
game/src/random.js     seeded RNG, math helpers, decoration hash
game/src/world.js      layout: roads, buildings, ramps, collisions, line-of-sight
game/src/input.js      keyboard, mouse and touch input (edges drained per tick)
game/src/entities.js   traffic AI, pedestrians, player and vehicle physics
game/src/police.js     wanted heat, pursuit, officers, helicopter, roadblocks
game/src/combat.js     punches, armored damage, BUSTED / WASTED, clinic respawn
game/src/weapons.js    arsenal, projectiles, grenades, enemies, both shops
game/src/missions.js   Auntie Bea's eight jobs (incl. combat waves + heat-lock escape)
game/src/races.js      street races: countdown, checkpoints, rubber-band rivals
game/src/crew.js       Vex & Mara: recruit, follow, ride, fight, revive
game/src/audio.js      Web Audio engine, sirens, three radio stations, gunfire
game/src/game.js       fixed-step simulation, shops, saves (v3)
game/src/render.js     2.5D canvas renderer, HUD, minimap, shop + race panels
game/src/shots.js      deterministic staged scenes for the screenshots
game/src/main.js       boot, frame loop, window.ViceHarbor debug handle
vendor/                the make.fun hand-in library (unmodified)
```

## Originality note

Vice Harbor — Port Serena is an original work: the city, districts, characters (Rio, Auntie Bea, Lulu Mar, Vex, Mara, Ferro), vehicle names, radio stations and the Serena Police Department were invented for this entry. It shares only the broad, unprotectable idea of a top-down open-world driving game with the genre's classics, and uses no names, art, audio, maps or other assets from any commercial game.
