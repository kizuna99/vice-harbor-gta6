// Vice Harbor — Port Serena · make.fun hand-in program (gta6-01)
// Runs on Node 22 with the standard library only. It assembles the
// submission in the output directory: a verbatim copy of the playable
// game/ folder, the staged screenshots/ folder, and a dossier.json
// manifest produced by the vendored make.fun library so the judges
// can verify sizes, counts and hashes exactly as scored.
//
// v2 note: the game grew an arsenal, two shops, a Ferro crew to fight
// and a searchlight pursuit — all of it still plain static files, so
// this hand-in program changes only in that it now also refuses to
// ship when the staged screenshot set is incomplete (see below).
//
// Locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and the
// output lands in /output, as the bounty expects.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output tree, then copy the two payload folders across.
mkdirSync(outputDir, { recursive: true });
cpSync(join(rootDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  cpSync(join(rootDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Hand-in guard: the four staged screenshots are part of the scored
// submission, so refuse to build a dossier at all when any of them is
// missing from the output — failing loudly here beats a silent
// three-screenshot hand-in at the grader.
const expectedShots = ['1-cover.jpg', '2-chase.jpg', '3-mission.jpg', '4-finale.jpg'];
const missingShots = expectedShots.filter(
  (name) => !existsSync(join(outputDir, 'screenshots', name)),
);
if (missingShots.length > 0) {
  throw new Error(
    `vice-harbor hand-in aborted: missing staged screenshot(s): ${missingShots.join(', ')}`,
  );
}

// Manifest with the scorer's published caps: dossier text budget,
// at most four screenshots of 256 KiB each, and the game tree limits
// (file count, total bytes, and per-path length).
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
