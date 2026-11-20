// Vice Harbor — Port Serena: hand-in program for the gta6-01 entry.
//
// The playable game lives in game/ as plain static files (an HTML page and
// its ES modules — no build step, no network). This program copies game/
// and screenshots/ into the output directory and writes dossier.json, the
// summary the judges read, using the vendored make.fun library.
//
//   node serve.ts     play locally at http://localhost:8080
//   node main.ts      hand in (writes to /output, or $MAKEFUN_OUTPUT_DIR)

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

// The caps below mirror the scorer's own gate, so an entry the scorer
// would refuse is refused here first instead of at judging time.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line receipt for whoever ran the hand-in: how much game went
// in, and how big the summary the judges will read turned out to be.
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`Vice Harbor handed in: ${gameFiles} game files, dossier ${dossier.length} bytes -> ${out}`);
