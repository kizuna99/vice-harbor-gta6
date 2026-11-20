// Vice Harbor — Port Serena · hand-in program for make.fun gta6-01.
// Node 22, standard library only. Assembles the submission in the
// output directory: a verbatim copy of game/, the staged
// screenshots/, and dossier.json from the vendored library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// With MAKEFUN_OUTPUT_DIR unset the output lands in /output.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(rootDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  cpSync(join(rootDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The four staged screenshots are part of the scored submission, so
// a missing one aborts the hand-in loudly instead of shipping short.
const expectedShots = ['1-cover.jpg', '2-chase.jpg', '3-mission.jpg', '4-finale.jpg'];
const missingShots = expectedShots.filter(
  (name) => !existsSync(join(outputDir, 'screenshots', name)),
);
if (missingShots.length > 0) {
  throw new Error(
    `vice-harbor hand-in aborted: missing staged screenshot(s): ${missingShots.join(', ')}`,
  );
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

const shotCount = existsSync(join(outputDir, 'screenshots'))
  ? readdirSync(join(outputDir, 'screenshots')).length
  : 0;
console.log(`vice-harbor v2: handed in game/ + ${shotCount}/${expectedShots.length} staged screenshots verified + dossier.json -> ${outputDir}`);
