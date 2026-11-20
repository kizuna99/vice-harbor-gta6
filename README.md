[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena

An original top-down open-world crime caper that runs entirely in the browser. You are **Rio**, a small-time runner in the sun-bleached port city of Port Serena, working eight jobs for fixer **Auntie Bea** while the Serena Police Department (SPD) does its best to ruin your week. Everything on screen is drawn procedurally on an HTML5 canvas and every sound is synthesized live with the Web Audio API — there are no image files, no audio files, no libraries and no network requests. An entry for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01).

## Screenshots

- **`screenshots/1-cover.jpg` — Palm Row at golden hour.** Rio cruises Palm Row in traffic with the job card, wanted HUD and live minimap on screen; the first delivery for Bea is already ticking.
- **`screenshots/2-chase.jpg` — Five-star night pursuit.** A stolen Solano GT downtown at night: SPD cruisers with flashing lightbars converge, a roadblock waits ahead, and Air One paints Rio with its searchlight.
- **`screenshots/3-mission.jpg` — Beach Money, on foot.** Mid-collection on the Boardwalk: the objective light pillar, the on-screen distance readout and the minimap marker show exactly where the next cash drop waits.
- **`screenshots/4-finale.jpg` — The Searchlight Run.** The last job of the book: a Dockmaster Truck hammering down the harbour road at night under three stars, timed, with the Old Town safehouse as the only way out.

## The city

- **One continuous map, 3200×2400**, dealt from a single seed so it is the same city on every visit: six districts — **Old Town, Palm Row, the University Quarter, Serena Marina, the Boardwalk and the Port Docks** — plus a beach, open water and a wooden pier (Pier Nine).
- **A working road grid** (8 avenues × 6 streets) with lane discipline: traffic holds its lane, brakes for whatever is ahead — including you, on foot, in the road — and turns at crossings.
- **2.5D presentation**: extruded rooftops with seeded window grids that light up after dark, sun-arc shadows that swing with the in-game clock, a full day–night cycle, neon that reflects on the harbour water, and streetlight pools at night.
- **Collision everywhere that matters**: buildings, dock containers and the sea itself all push back, and containers double as hard cover — they block lines of sight and gunfire.

## The law

- **Heat is a score (0–260); stars are its public face** — thresholds at 30 / 70 / 120 / 170 / 260 for one through five stars. Heat cools when you stop being interesting.
- **SPD cruisers** hunt in packs sized by your stars, steer, corner and ram; **officers pile out** up close and work an **arrest meter** — stand still in reach and you are **BUSTED** (fined, released at the SPD front desk).
- **Air One**, the police helicopter, joins at **three stars** with a live searchlight. At **four stars** the SPD parks **roadblocks** across the road ahead of you.
- Take too much damage anywhere and you are **WASTED**, waking up at Serena General minus the hospital's cut.

## The work — Auntie Bea's job book

Eight jobs, chained step by step with an on-screen job card, a gold objective pillar and a minimap marker:

1. **Serena Welcome** — a parcel across Palm Row, a roll past the gun shop, home again.
2. **Checkpoint Rush** — four checkpoints across the east side against your own nerve.
3. **Borrowed Wheels** — lift the marked Solano GT and deliver it to Serena Customs.
4. **Lulu's Ride** — ferry singer Lulu Mar from the marina stage to the boardwalk.
5. **Beach Money** — work the boardwalk collections stall by stall.
6. **Dockside Pickup** — load up at the dock warehouse, cool off at the safehouse.
7. **Dockside Crossfire** — the strongbox job: **three waves, ten gunmen** in a container arena. They burst-fire, strafe, and use the containers for cover exactly like you do.
8. **Searchlight Run** — the finale: **heat is locked at exactly 170 (four stars) for 170 seconds** with Air One overhead. Reach the Old Town safehouse and the heat clears; get caught and the night is over.

Jobs pay cash and **respect** — and respect is what the crew counts.

## Guns, shops and garages

- **Serena Munitions** (600,1000) — press **E** at the door, buy by number: **Harbor Pistol $180**, **Calle SMG $420** (full auto), **Pier Shotgun $650** (six pellets), **grenades ×3 $90** (0.75s fuse, area damage, cars chain-explode), ammo refills, medkits, and a **Kevlar vest $150** — armor 100 that **absorbs 65%** of incoming damage.
- **Serena Customs** (2200,1400) — drive in and press **E**: **engine tune $300** (+12% top speed and pull), **harbor plating $350** (half collision damage), full repair $120.
- Weapons ride on slots **1–5**, **Q** reloads (empty mags reload themselves), **J** fires. Gunfire only draws the law when the law is close enough to hear it.

## Wheels and trouble

- **Six drivable models** with distinct handling: Calle Coupe, Solano GT, Palma Sedan, Harbor Taxi, Dockmaster Truck — and the SPD's own Serena Cruiser, if you can take one.
- **Four stunt ramps** (Palm Row, the University drop, Marina heights, the Boardwalk run-up): hit one fast and lined up and the car flies, dust and all.
- **Two street races**, flagged off with **J** at a start marker — a real 3-2-1 countdown, **eight checkpoints**, **two rival cars on rubber-band pace**: **Palm Row Sprint** pays **$400**, **Harbor Lights Run** pays **$650**, first home only.
- **A crew**: at **30 respect, Vex** signs on at the Old Town safehouse door (**E** to recruit); at **70, Mara** follows. Crew run formation behind you, pile into your car, shoot back with their own weapons, go down under fire and get revived when you come back for them. **C** toggles follow / hold position. Membership persists in the save.
- **Radio**: three fully procedural stations — **Serena Sun FM, Harbor Wave Radio, Night Pier 88** — composed live from seeded patterns. **N** cycles them in the car. The radio only ever makes noise; it never touches game state.

## Saving

Progress autosaves to `localStorage` under **`vice-harbor-save-v3`** whenever a job is finished: cash, respect, weapons and ammo, garage mods, mission progress, crew roster, even the radio station. The title screen's **CONTINUE** picks it all back up.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| E | Interact — enter & exit cars, shops, garage, recruit crew |
| J (or click) | Fire weapon · start a race at a marker |
| Q | Reload |
| 1–5 | Weapon slots (in shops: buy by number) |
| C | Crew follow / hold |
| N | Cycle radio station (in a car) |
| ESC | Close shop · pause |

## Running it

```
node serve.ts     # serves game/ at http://localhost:8080
node main.ts      # hands the entry in: copies game/ + screenshots/ to
                  # /output (or $MAKEFUN_OUTPUT_DIR) and writes dossier.json
```

Node 22, standard library only. The game itself is plain static files — `game/index.html` and its ES modules — and plays offline in any desktop browser.
