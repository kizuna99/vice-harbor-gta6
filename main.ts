// main.ts — Vice Harbor: Port Serena hand-in program (make.fun gta6-01).
//
// What this does, in plain terms: it takes the finished game (the game/
// folder) and the four staged screenshots (the screenshots/ folder) that
// sit next to this file, copies both into the output directory the
// platform gives us, and then asks the kit's dossier builder to describe
// the result. The dossier lands in the output as dossier.json and a
// single summary line goes to stdout so the run log stays readable.
//
// Node 22, standard library only — nothing to install.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The output folder may not exist yet on a fresh runner.
mkdirSync(outDir, { recursive: true });

// Copy the two payload folders across. cpSync with recursive keeps the
// layout identical to the repo, which is what the player expects.
for (const folder of ['game', 'screenshots']) {
  const from = join(here, folder);
  if (!existsSync(from)) {
    throw new Error(`hand-in is incomplete: missing ${folder}/ next to main.ts`);
  }
  cpSync(from, join(outDir, folder), { recursive: true });
}

// Hand-in guard: the four staged screenshots are part of the entry's
// promise (cover, chase, mission, finale). If any of them failed to make
// it into the output, fail loudly here instead of handing in a package
// that silently lacks its evidence.
const EXPECTED_SHOTS = ['1-cover.jpg', '2-chase.jpg', '3-mission.jpg', '4-finale.jpg'];
const stagedShots = EXPECTED_SHOTS.filter((name) => existsSync(join(outDir, 'screenshots', name)));
if (stagedShots.length !== EXPECTED_SHOTS.length) {
  const missing = EXPECTED_SHOTS.filter((name) => !stagedShots.includes(name));
  throw new Error(`hand-in is incomplete: missing staged screenshot(s): ${missing.join(', ')}`);
}

// Describe what we just staged. The limits below are the bounty's own
// budget: dossier text cap, at most four screenshots of at most 256 KiB
// each, and generous ceilings for the game payload itself.
const dossier = await buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n', 'utf8');

// One line, everything a human scanning the log needs to know — including
// the verified screenshot count from the guard above.
console.log(`vice-harbor: staged game/ + ${stagedShots.length}/${EXPECTED_SHOTS.length} screenshots into ${outDir} and wrote dossier.json`);
