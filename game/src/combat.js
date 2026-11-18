// combat.js — fists only. Port Serena has no firearms: Rio settles things
// with a punch, and the SPD settles things with an arrest meter.
// This module owns melee, damage, and the BUSTED / WASTED end states.

import { CFG } from './config.js';
import { dist } from './random.js';
import { knockDownPed } from './entities.js';
import { world } from './world.js';

export const PUNCH_RANGE = 38;
export const PUNCH_ARC = 1.15; // radians either side of facing

// Attempt a punch. Returns a small report so game.js can add heat, spawn
// particles and play the thump. Only works on foot.
export function tryPunch(game) {
  const p = game.player;
  if (p.inCar || p.punchCooldown > 0) return null;
  p.punchCooldown = 0.34;
  p.punchAnim = 0.22;
  let hit = null;
  for (const ped of game.peds) {
    if (ped.state === 'down' || ped.isPassenger) continue;
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d > PUNCH_RANGE) continue;
    let da = Math.atan2(ped.y - p.y, ped.x - p.x) - p.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > PUNCH_ARC) continue;
    hit = ped;
    break;
  }
  if (!hit) return { hit: null };
  knockDownPed(hit, p.angle);
  game.threatAt = { x: p.x, y: p.y, timer: 1.2 };
  if (hit.role === 'officer') {
    game.police.crime('punchOfficer');
    game.stats.officersHit++;
  } else {
    game.police.crime('punchPed');
    game.stats.pedsHit++;
  }
  game.audio?.sfx('punch');
  game.spawnParticles(hit.x, hit.y, 6, '#ffffff');
  return { hit };
}

export function damagePlayer(game, amount) {
  const p = game.player;
  if (game.screen !== 'play') return;
  p.health -= amount;
  p.hurtFlash = 0.25;
  if (p.health <= 0) {
    p.health = 0;
    endRun(game, 'wasted');
  }
}

// Arrest meter is filled by game.js while officers are close; when it
// tops out, or when health empties, the run ends here.
export function endRun(game, kind) {
  if (game.screen !== 'play') return;
  game.screen = kind; // 'busted' | 'wasted'
  game.endTimer = 0;
  game.audio?.sfx(kind === 'busted' ? 'busted' : 'wasted');
}

// Respawn at Harbor Clinic: 10% of carried cash is the bill, wanted is
// wiped, health restored, and any job in progress resets its current step.
export function respawn(game) {
  const p = game.player;
  const fee = Math.floor(p.cash * CFG.clinicFeeRate);
  p.cash -= fee;
  p.health = CFG.playerHealth;
  p.arrestMeter = 0;
  p.inCar = null;
  const clinic = world.anchors.clinic;
  p.x = clinic.x; p.y = clinic.y + 60;
  p.angle = -Math.PI / 2;
  game.police.clear();
  game.police.clearUnits(game);
  game.missions?.resetCurrentStep(game);
  game.screen = 'play';
  game.lastFee = fee;
  return fee;
}
