// Vice Harbor — Port Serena: the hand-in program for gta6-01.
//
// The game itself is the game/ folder beside this file — plain static files
// (an HTML shell and its ES modules) that a desktop browser runs offline,
// with no library code and no network request. This program copies game/
// and screenshots/ into the output directory and writes dossier.json there
// with the vendored make.fun library, so the judge reads exactly the build
// that was played and timed here.
//
// Run it:  node main.ts            (writes to /output in the grader)
//          MAKEFUN_OUTPUT_DIR=out node main.ts   (anywhere else)

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own gate: a 160 KiB text budget for the
// dossier, at most four screenshots of 256 KiB each, and the game folder
// well under the file-count and byte ceilings.
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

// One line of operator feedback: where the build went and how heavy the
// summary the judge will read turned out to be.
console.log(`Vice Harbor handed in to ${out} (dossier.json ${statSync(join(out, 'dossier.json')).size} bytes)`);
