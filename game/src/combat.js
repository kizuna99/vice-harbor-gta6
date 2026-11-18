// Fists, health and the two ways a run ends: BUSTED and WASTED.
// Respawning happens at Harbor Clinic and costs ten percent of cash.

import { PLAYER, CRIME_HEAT } from './config.js';
import { clamp } from './random.js';
import { knockPed } from './entities.js';
import { addHeat } from './police.js';

export const CLINIC = { x: 640, y: 1080, name: 'Harbor Clinic' };

export function tryPunch(game) {
  const p = game.player;
  if (p.car || p.punchT > 0 || p.dead || p.busted) return false;
  p.punchT = PLAYER.punchCooldown;
  p.punchAnim = 1;
  game.audio?.punch();

  const fx = Math.sin(p.angle), fy = -Math.cos(p.angle);
  let hitSomething = false;

  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - p.x, dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.punchRange + 8 && dx * fx + dy * fy > 0) {
      knockPed(ped, p.angle);
      game.spawnHitParticles(ped.x, ped.y);
      addHeat(CRIME_HEAT.punch, game);
      hitSomething = true;
    }
  }
  // Officers can be shoved back too, at a steeper heat price.
  for (const o of game.policeRef.officers) {
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.punchRange + 6 && dx * fx + dy * fy > 0) {
      o.x += fx * 26; o.y += fy * 26;
      addHeat(CRIME_HEAT.punch * 2, game);
      hitSomething = true;
    }
  }
  return hitSomething;
}

export function damagePlayer(game, amount) {
  const p = game.player;
  if (p.dead || p.busted) return;
  // Being inside a car soaks most of the blow.
  p.health = clamp(p.health - (p.car ? amount * 0.35 : amount), 0, PLAYER.maxHealth);
  game.shake = Math.min(14, (game.shake || 0) + amount * 0.22);
  if (p.health <= 0) {
    p.dead = true;
    game.onWasted?.();
  }
}

export function respawnAtClinic(game) {
  const p = game.player;
  const fee = Math.floor(game.cash * 0.10);
  game.cash -= fee;
  p.health = PLAYER.maxHealth;
  p.dead = false;
  p.busted = false;
  p.car = null;
  p.x = CLINIC.x; p.y = CLINIC.y;
  game.lastClinicFee = fee;
  return fee;
}

export function bustedPenalty(game) {
  const fine = Math.min(game.cash, 150 + game.policeRef.stars * 60);
  game.cash -= fine;
  return fine;
}
