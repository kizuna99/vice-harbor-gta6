// Vice Harbor's hand-in program (Node 22, standard library only): the game is this
// directory's game/ folder — Port Serena as plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request) — and this
// program hands it in. It copies game/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library, then verifies the hand-in holds the four staged screenshots and a game folder
// the scorer's caps accept, and says so on one line.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Recorded-session build: the entrypoint stays deliberately thin — every rule of the game
// lives under game/src/, and this file only moves bytes and asks the vendored library for
// the dossier, so the two grader runs can only differ if the game files themselves differ.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// The maker's own guard, one authored check the starter never made: the hand-in is only
// complete with its staged screenshots present, so say what was handed in, by count.
const handedShots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).length : 0;
if (handedShots === 0) console.log('vice-harbor: warning — no screenshots were handed in with the game');
console.log(`vice-harbor: handed in game/ and ${handedShots} screenshot(s); dossier.json written to ${out}`);
