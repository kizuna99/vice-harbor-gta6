// combat.js — the Dockside gunmen: how they move, when they fire, and why
// they check the wall first. A gunman keeps his distance, strafes between
// bursts, and only pulls the trigger with a clear line to Rio — a wall in
// the way means he repositions instead of wasting the magazine.

import { angleTo, clamp, dirFrom } from './random.js';
import { fireProjectile } from './weapons.js';

export function makeGunman(x, y, tough = 1) {
  return {
    x, y, angle: 0,
    hp: 55 * tough, maxHp: 55 * tough,
    state: 'fight',
    burstT: 1 + Math.random() * 1.4,  // time to next burst
    burstLeft: 0,                      // rounds left in the current burst
    burstGap: 0,                       // time between burst rounds
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeT: 2 + Math.random() * 2,
    downT: 0,
  };
}

export function updateEnemies(game, dt) {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.state === 'down') { e.downT += dt; continue; }
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = angleTo(e.x, e.y, p.x, p.y);
    const los = !game.world.lineBlocked(e.x, e.y, p.x, p.y);

    // Movement: hold a fighting distance of roughly 170px, strafing
    // sideways between bursts, sliding around walls when the line is shut.
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeT = 1.6 + Math.random() * 2; e.strafeDir *= -1; }
    let mx = 0, my = 0;
    const dir = dirFrom(e.angle);
    if (d > 205) { mx += dir.x; my += dir.y; }
    else if (d < 130) { mx -= dir.x; my -= dir.y; }
    if (los) { mx += -dir.y * e.strafeDir * 0.7; my += dir.x * e.strafeDir * 0.7; }
    else { mx += dir.x * 0.8; my += dir.y * 0.8; }
    const ml = Math.hypot(mx, my) || 1;
    const speed = 96;
    const fixed = game.world.collide(e.x + (mx / ml) * speed * dt, e.y + (my / ml) * speed * dt, 13);
    e.x = fixed.x; e.y = fixed.y;

    // Fire control: bursts of three, only with line of sight, and never
    // while Rio is already down or the game is somewhere else.
    if (game.state !== 'playing') continue;
    if (e.burstLeft > 0) {
      e.burstGap -= dt;
      if (e.burstGap <= 0 && los) {
        e.burstLeft -= 1;
        e.burstGap = 0.11;
        const spread = (Math.random() - 0.5) * 0.09;
        fireProjectile(game, e.x, e.y, e.angle + spread, { speed: 540, range: 560, damage: 6, hostile: true });
        game.audio.shot('smg');
      }
    } else {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        if (los && d < 430) { e.burstLeft = 3; e.burstGap = 0; }
        e.burstT = 1.5 + Math.random() * 1.3;
      }
    }
  }
  // Sweep the fallen out after a while so the field stays readable.
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    if (game.enemies[i].state === 'down' && game.enemies[i].downT > 14) game.enemies.splice(i, 1);
  }
}

export function enemyCount(game) {
  let alive = 0, down = 0;
  for (const e of game.enemies) (e.state === 'down' ? (down += 1) : (alive += 1));
  return { alive, down };
}

export const clampHp = (v, max) => clamp(v, 0, max);
