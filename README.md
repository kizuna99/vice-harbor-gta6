[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kizuna99/vice-harbor-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Harbor — Port Serena

Vice Harbor is a complete top-down open-world crime game that runs offline in a desktop browser from static files — no build step, no network request, no image or audio files: every street, car, palm and song is drawn and synthesized in code. You are Rio, a courier in the sun-soaked coastal city of Port Serena, running six story jobs for fixer Auntie Bea while the Serena Police Department escalates from a single patrol car to a helicopter.

## What the screenshots demonstrate

- `screenshots/1-cover.jpg` — driving at golden hour in Palm Row: traffic, pedestrians, the mission panel with objective and distance, the minimap, cash/respect, and the radio readout.
- `screenshots/2-chase.jpg` — a five-star pursuit at night: SPD interceptors with flashing light bars, the police helicopter and its searchlight, headlight cones, neon signs lit, and the getaway objective on the HUD.
- `screenshots/3-mission.jpg` — on foot on the Boardwalk during the *Beach Money* job: the collection objective, the objective edge-arrow, pedestrians, a taxi in traffic, beach, palms and sea.
- `screenshots/4-finale.jpg` — the *Serena Send-Off* getaway on Ocean Drive at night: a truck run toward Pier Nine with three stars, patrol cars converging and the helicopter overhead.

## Features (all playable, all verified in a headless browser with zero console errors)

- **A living multi-district city** — Old Town, Palm Row, the University Quarter, Serena Marina, the Boardwalk and the Port Docks: a road grid with named buildings, palms, piers and a causeway islet, plus a full day–night cycle (lit windows, neon signs and headlight cones after dark).
- **On foot and behind the wheel** — walk, sprint, and steal any of the traffic or parked cars (six original models, from the Calle Coupe to the Dockmaster Truck); the driver of a stolen moving car bails out and runs.
- **Traffic and pedestrians** — cars follow the road network, brake for each other and turn at intersections; pedestrians stroll the sidewalks, flee danger and fall when hit.
- **Six story jobs with progression** — *First Run for Bea* (delivery), *Neon Rush* (a five-checkpoint timed street race at dusk), *Hot Solano* (steal the marked Solano GT and deliver it), *VIP to the Marina* (ferry singer Lulu Mar against the clock), *Beach Money* (three on-foot collections), and *Serena Send-Off* (a dock-to-pier getaway). Each pays cash and respect, shows its objective on the minimap and as an on-screen arrow, and autosaves on completion.
- **Wanted 1–5 stars** — crimes (theft, assault, hit-and-run) raise heat; more stars mean more and faster SPD cars, officers who chase on foot and arrest, and a helicopter with a searchlight at three stars and up. Heat cools only while no uniform can see you.
- **Melee combat and consequences** — punch pedestrians and officers (J or click); get caught and you are BUSTED, get flattened and you are WASTED — either way you wake at Harbor Clinic 10% poorer.
- **HUD and minimap** — wanted stars, cash, respect, health, speed, the current job with its timer, an objective marker with a light pillar, and a live minimap with traffic, police and the objective.
- **Procedural sound** — a Web Audio engine hum that follows your speed, two-tone sirens that rise as patrol cars close in, and three radio stations of synthesized music (Serena Sun FM, Harbor Wave Radio, Night Pier 88). N changes station, M mutes.
- **Start screen, pause, saves** — a title screen with PLAY NOW and CONTINUE, a pause screen, busted/wasted summaries, and an autosave in `localStorage` after every job.

## Play it from zero

```sh
node serve.ts            # serves game/ on http://localhost:8080 (Node 22, nothing to install)
```

Open `http://localhost:8080` in desktop Chrome and press **PLAY NOW** (or Enter).

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Walk / drive and steer |
| Shift | Sprint on foot |
| E or F (or Enter) | Enter / exit the nearest car |
| Space | Brake (in a car) |
| J or mouse click | Punch |
| H | Horn |
| N | Next radio station |
| R | Reset position when stuck |
| P or Esc | Pause |
| M | Mute |
| Touch buttons | On-screen steering, pedals, E and J appear after the first touch |

## Honest limits

Combat is melee plus the car itself — there are no firearms. The world is 2D top-down canvas, not 3D. Timed jobs reset their step when the clock runs out instead of failing the whole job. Everything above was verified by playing this exact build headlessly (title → drive → wanted escalation → arrest → save/reload) with zero console errors at ~60 FPS.

## Layout

`main.ts` hands the game in (copies `game/` and `screenshots/` to the output and writes the dossier). `game/src/` holds one file per job: `world.js` (Port Serena), `game.js` (the simulation), `entities.js` (traffic, parked cars, pedestrians), `police.js` (wanted, pursuit, officers, helicopter), `combat.js` (melee, busted/wasted), `missions.js` (the six jobs), `render.js` (canvas world, HUD, minimap, menus), `audio.js` (procedural Web Audio), `input.js` (keyboard, mouse, touch), `shots.js` (the staged screenshot scenes), `main.js` (boot and loop). `vendor/makefun-game.ts` is make.fun's own dossier library, unchanged.

## Originality

Port Serena, Rio, Auntie Bea, Lulu Mar, the Serena PD, every vehicle model, street, business, job and radio station in this game are original creations for this entry. No name, character, map, art, music or asset from any commercial game is used or imitated by name.

MIT licensed. Entered on [make.fun](https://make.fun/bounty/gta6-01) in the “Make GTA 6” bounty (gta6-01).
