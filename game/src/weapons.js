// The v2 arsenal: firearms, grenades, vehicle damage and the Ferro
// crew who shoot back. One projectile system serves everyone — Rio's
// bullets and enemy bullets fly the same way, get stopped by the same
// buildings, and cook off the same cars.

import { CRIME_HEAT } from './config.js';
import { rand, range, clamp } from './random.js';
import { collideRect, resolveCollision, segmentBlocked } from './world.js';
import { police, addHeat } from './police.js';
import { damagePlayer } from './combat.js';
import { knockPed } from './entities.js';

export const WEAPONS = {
  fists:   { id: 'fists',   name: 'Fists',           slot: 'Digit5' },
  pistol:  { id: 'pistol',  name: 'Harbor Pistol',   slot: 'Digit1', damage: 34, magSize: 12, reserveStart: 36, interval: 0.26, speed: 660, range: 470, spread: 0.012, pellets: 1, reloadTime: 0.8 },
  smg:     { id: 'smg',     name: 'Calle SMG',       slot: 'Digit2', damage: 15, magSize: 30, reserveStart: 90, interval: 0.09, speed: 640, range: 430, spread: 0.05,  pellets: 1, reloadTime: 1.0, auto: true },
  shotgun: { id: 'shotgun', name: 'Dockside Shotgun', slot: 'Digit3', damage: 13, magSize: 6,  reserveStart: 18, interval: 0.85, speed: 620, range: 205, spread: 0.085, pellets: 6, reloadTime: 1.3 },
  grenade: { id: 'grenade', name: 'Grenades',        slot: 'Digit4', fuse: 0.75, throwSpeed: 330, interval: 0.55 },
};

export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
export const WEAPON_BY_SLOT = { Digit1: 'pistol', Digit2: 'smg', Digit3: 'shotgun', Digit4: 'grenade', Digit5: 'fists' };

export function createAmmo() {
  return {
    pistol:  { mag: 0, reserve: 0 },
    smg:     { mag: 0, reserve: 0 },
    shotgun: { mag: 0, reserve: 0 },
    grenade: { mag: 0, reserve: 0 }, // for grenades, mag IS the count carried
  };
}

export function defaultOwned() {
  return { fists: true, pistol: false, smg: false, shotgun: false, grenade: false };
}

export function grantWeapon(game, id) {
  game.weaponsOwned[id] = true;
  const def = WEAPONS[id];
  if (id === 'grenade') { game.ammo.grenade.mag += 3; return; }
  if (def) {
    game.ammo[id].mag = def.magSize;
    game.ammo[id].reserve += def.reserveStart;
  }
}

// --- shared damage helpers -------------------------------------------------

export function damageCar(game, car, amount) {
  if (car.wrecked) return;
  car.damage += amount;
  if (car.damage >= 100) {
    car.damage = 100;
    car.wrecked = true;
    car.speed = 0;
    // Cooking off is an explosion in its own right: it hurts everyone
    // nearby and throws up the fireball the renderer keeps feeding.
    spawnExplosion(game, car.x, car.y, { carBlast: true });
    if (game.player.car === car) {
      const p = game.player;
      p.car = null;
      p.x = car.x + 34; p.y = car.y + 10;
      damagePlayer(game, 12);
    }
  }
}

export function spawnExplosion(game, x, y, opts) {
  const o = opts || {};
  game.shake = Math.min(16, (game.shake || 0) + 9);
  game.audio?.explosion();
  // Fireball + sparks + a smoke column.
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const sp = 30 + rand() * 190;
    game.spawnParticle(x, y, ['#ff9f1c', '#ff5714', '#ffd166'][Math.floor(rand() * 3)], {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.3 + rand() * 0.5, size: 3 + rand() * 5, kind: 'fire',
    });
  }
  for (let i = 0; i < 10; i++) {
    game.spawnParticle(x, y, '#5a5f6a', {
      vx: range(-22, 22), vy: range(-46, -14),
      life: 0.9 + rand() * 0.9, size: 6 + rand() * 8, kind: 'smoke',
    });
  }
  // Area damage, falling off with distance.
  const R = 96;
  const p = game.player;
  const pd = Math.hypot(p.x - x, p.y - y);
  if (p.car) {
    if (pd < R + 20) damageCar(game, p.car, 34 * (1 - pd / (R + 40)));
  } else if (pd < R) {
    damagePlayer(game, 52 * (1 - pd / R));
  }
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < R) hurtEnemy(game, e, 95 * (1 - d / R) + 12);
  }
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < R) { knockPed(ped, Math.atan2(ped.x - x, -(ped.y - y))); ped.health -= 30; }
  }
  for (const car of [...game.cars, ...police.cars]) {
    if (car === game.player.car) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < R) damageCar(game, car, 62 * (1 - d / R) + 10);
  }
  // A blast near a unit is very much witnessed.
  if (anyUnitNear(game, x, y, 430)) addHeat(CRIME_HEAT.blast, game);
  void o;
}

function anyUnitNear(game, x, y, r) {
  for (const c of police.cars) if (Math.hypot(c.x - x, c.y - y) < r) return true;
  for (const o of police.officers) if (Math.hypot(o.x - x, o.y - y) < r) return true;
  return false;
}

// --- firing ------------------------------------------------------------------

export function startReload(game) {
  const id = game.player.weapon;
  const def = WEAPONS[id];
  if (!def || !def.magSize) return false;
  const ammo = game.ammo[id];
  if (ammo.mag >= def.magSize || ammo.reserve <= 0 || game.reloadT > 0) return false;
  game.reloadT = def.reloadTime;
  game.audio?.reload();
  return true;
}

function finishReload(game) {
  const id = game.player.weapon;
  const def = WEAPONS[id];
  if (!def || !def.magSize) return;
  const ammo = game.ammo[id];
  const move = Math.min(def.magSize - ammo.mag, ammo.reserve);
  ammo.mag += move;
  ammo.reserve -= move;
}

export function fireBullet(game, from, angle, def, hostile) {
  const spread = (rand() - 0.5) * 2 * def.spread;
  const a = angle + spread;
  game.projectiles.push({
    x: from.x + Math.sin(angle) * 16, y: from.y - Math.cos(angle) * 16,
    px: from.x, py: from.y,
    vx: Math.sin(a) * def.speed, vy: -Math.cos(a) * def.speed,
    life: def.range / def.speed,
    damage: def.damage,
    hostile: !!hostile,
  });
}

export function tryFire(game) {
  const p = game.player;
  const id = p.weapon;
  if (id === 'grenade') {
    if (game.fireCd > 0) return;
    if (game.ammo.grenade.mag <= 0) { game.audio?.dryFire(); game.fireCd = 0.3; return; }
    game.ammo.grenade.mag -= 1;
    game.fireCd = WEAPONS.grenade.interval;
    const fx = Math.sin(p.angle), fy = -Math.cos(p.angle);
    game.grenades.push({
      x: p.x + fx * 14, y: p.y + fy * 14,
      vx: fx * WEAPONS.grenade.throwSpeed, vy: fy * WEAPONS.grenade.throwSpeed,
      z: 16, vz: 215, fuse: WEAPONS.grenade.fuse,
    });
    game.audio?.throwWhoosh();
    return;
  }
  const def = WEAPONS[id];
  if (!def || !def.magSize) return;
  if (game.reloadT > 0 || game.fireCd > 0) return;
  const ammo = game.ammo[id];
  if (ammo.mag <= 0) {
    game.audio?.dryFire();
    game.fireCd = 0.3;
    startReload(game);
    return;
  }
  ammo.mag -= 1;
  game.fireCd = def.interval;
  const from = p.car ? { x: p.car.x, y: p.car.y } : p;
  for (let i = 0; i < def.pellets; i++) fireBullet(game, from, p.angle, def, false);
  game.muzzle = { x: from.x + Math.sin(p.angle) * 20, y: from.y - Math.cos(p.angle) * 20, angle: p.angle, t: 0.05 };
  game.shake = Math.min(10, (game.shake || 0) + (id === 'shotgun' ? 3.2 : 0.7));
  if (id === 'shotgun') game.audio?.shotgun(); else game.audio?.shoot(id === 'smg');
  if (anyUnitNear(game, p.x, p.y, 430)) addHeat(CRIME_HEAT.gunshot, game);
  if (ammo.mag === 0) startReload(game);
}

export function updateWeapons(game, dt) {
  game.fireCd = Math.max(0, game.fireCd - dt);
  if (game.muzzle) {
    game.muzzle.t -= dt;
    if (game.muzzle.t <= 0) game.muzzle = null;
  }
  if (game.reloadT > 0) {
    game.reloadT -= dt;
    if (game.reloadT <= 0) finishReload(game);
  }

  // Grenades in flight: a little arc, then the fuse decides.
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const n = game.grenades[i];
    n.x += n.vx * dt; n.y += n.vy * dt;
    n.vz -= 520 * dt;
    n.z += n.vz * dt;
    if (n.z < 0) { n.z = 0; n.vz = Math.abs(n.vz) * 0.35; n.vx *= 0.6; n.vy *= 0.6; }
    n.fuse -= dt;
    if (n.fuse <= 0) {
      game.grenades.splice(i, 1);
      spawnExplosion(game, n.x, n.y, {});
    }
  }

  // Bullets.
  const p = game.player;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const b = game.projectiles[i];
    b.px = b.x; b.py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && collideRect(b.x, b.y, 1)) {
      game.spawnParticle(b.x, b.y, '#cfd8dc', { life: 0.18, size: 2, kind: 'spark' });
      dead = true;
    }
    if (!dead) dead = bulletHit(game, b, p);
    if (dead) game.projectiles.splice(i, 1);
  }
}

function bulletHit(game, b, p) {
  if (b.hostile) {
    // Enemy fire: Rio on foot, or the car he is driving.
    if (p.car) {
      if (Math.hypot(p.car.x - b.x, p.car.y - b.y) < 27) {
        damageCar(game, p.car, b.damage * 0.6);
        damagePlayer(game, b.damage * 0.4);
        return true;
      }
    } else if (Math.hypot(p.x - b.x, p.y - b.y) < 13) {
      damagePlayer(game, b.damage);
      return true;
    }
    // Hostile fire can also drop a crew member standing in the open.
    for (const m of game.crew) {
      if (m.inCar || m.state === 'down') continue;
      if (Math.hypot(b.x - m.x, b.y - m.y) < 13) {
        m.health -= b.damage;
        if (m.health <= 0) {
          m.health = 0; m.state = 'down'; m.reviveT = 12;
          showMessage(game, `${m.name} is down!`, 2.6);
        }
        return true;
      }
    }
    return false;
  }
  // Rio's fire: enemies first, then officers, peds, and every car.
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    if (Math.hypot(e.x - b.x, e.y - b.y) < 14) {
      hurtEnemy(game, e, b.damage);
      return true;
    }
  }
  for (const o of police.officers) {
    if (o.state === 'down') continue;
    if (Math.hypot(o.x - b.x, o.y - b.y) < 12) {
      o.health -= b.damage;
      addHeat(CRIME_HEAT.shootCop, game);
      if (o.health <= 0) {
        o.state = 'down'; o.downT = 6;
        addHeat(CRIME_HEAT.downCop, game);
      }
      return true;
    }
  }
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
      knockPed(ped, Math.atan2(b.vx, -b.vy));
      addHeat(CRIME_HEAT.hitPed, game);
      return true;
    }
  }
  for (const car of [...game.cars, ...police.cars]) {
    if (car === p.car || car.wrecked) continue;
    if (Math.hypot(car.x - b.x, car.y - b.y) < 27) {
      damageCar(game, car, b.damage);
      if (car.police) addHeat(CRIME_HEAT.shootCop, game);
      game.spawnParticle(b.x, b.y, '#ffd166', { life: 0.2, size: 2, kind: 'spark' });
      return true;
    }
  }
  return false;
}

// --- the Ferro crew -----------------------------------------------------------

const FERRO_SHIRTS = ['#123c3a', '#0f2e2e', '#164e4a', '#1b3a34'];

export function makeEnemy(x, y, idx) {
  return {
    id: 1000 + idx,
    x, y, angle: range(0, Math.PI * 2),
    health: 60,
    state: 'fight', // fight | down
    downT: 0,
    fireT: range(0.7, 1.9),   // time until the next burst
    burst: 0,                 // shots left in the current burst
    burstT: 0,
    strafeDir: idx % 2 === 0 ? 1 : -1,
    strafeT: range(1.2, 2.6),
    walkCycle: 0,
    shirt: FERRO_SHIRTS[idx % FERRO_SHIRTS.length],
    skin: '#c68642',
  };
}

export function spawnWave(game, cx, cy, count, waveIdx) {
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const a = (i / count) * Math.PI * 2 + waveIdx * 0.7;
      const d = 70 + rand() * 80;
      const x = clamp(cx + Math.cos(a) * d, 2140, 3130);
      const y = clamp(cy + Math.sin(a) * d, 920, 1610);
      if (collideRect(x, y, 13)) continue;
      game.enemies.push(makeEnemy(x, y, game.enemiesDownTotal + spawned + waveIdx * 10));
      spawned++;
      break;
    }
  }
  return spawned;
}

export function enemiesStanding(game) {
  let n = 0;
  for (const e of game.enemies) if (e.state !== 'down') n++;
  return n;
}

export function hurtEnemy(game, e, amount) {
  if (e.state === 'down') return;
  e.health -= amount;
  game.spawnParticle(e.x, e.y, '#ffd166', { life: 0.25, size: 2.4, kind: 'spark' });
  if (e.health <= 0) {
    e.state = 'down';
    e.downT = 999;
    game.enemiesDownTotal++;
    game.audio?.enemyDown();
  }
}

const ENEMY_GUN = { damage: 9, speed: 560, spread: 0.055, range: 360 };

export function updateEnemies(game, dt) {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    // Ferro shoot whoever is closest: Rio, or a crew member in the open.
    let tx = p.car ? p.car.x : p.x;
    let ty = p.car ? p.car.y : p.y;
    let bestD = Math.hypot(tx - e.x, ty - e.y);
    for (const m of game.crew) {
      if (m.inCar || m.state === 'down') continue;
      const d = Math.hypot(m.x - e.x, m.y - e.y);
      if (d < bestD) { bestD = d; tx = m.x; ty = m.y; }
    }
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dx, -dy);
    e.walkCycle += dt * 9;

    // Movement: close to the band, back off inside it, strafe within it.
    let mx = 0, my = 0;
    const ux = dx / d, uy = dy / d;
    if (d > 245) { mx = ux; my = uy; }
    else if (d < 100) { mx = -ux; my = -uy; }
    else {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = range(1.2, 2.6); }
      mx = -uy * e.strafeDir * 0.7; my = ux * e.strafeDir * 0.7;
    }
    // No line of sight through a container? Push toward Rio anyway.
    if (segmentBlocked(e.x, e.y, tx, ty) && d > 90) { mx = ux; my = uy; }
    e.x += mx * 118 * dt;
    e.y += my * 118 * dt;
    resolveCollision(e, 11);

    // Fire control: three-round bursts whenever the shot is clear.
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burst--;
        e.burstT = 0.11;
        fireBullet(game, e, e.angle, ENEMY_GUN, true);
        game.audio?.enemyShoot();
      }
    } else {
      e.fireT -= dt;
      if (e.fireT <= 0) {
        if (d > 80 && d < 340 && !segmentBlocked(e.x, e.y, tx, ty)) {
          e.burst = 3;
          e.burstT = 0;
        }
        e.fireT = range(1.5, 2.5);
      }
    }
  }
}
