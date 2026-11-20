// Arsenal, gunfire, grenades, enemies and the two shops.
// Serena Munitions sells the hardware; Serena Customs mods the car.
// Projectiles are short-lived tracer objects tested against buildings,
// people and vehicles every tick.

import { CRIME_HEAT, PLAYER } from './config.js';
import { clamp } from './random.js';
import { collideRect, lineBlocked } from './world.js';
import { addHeat } from './police.js';

export const WEAPONS = {
  fists: { name: 'Fists', slot: 5, damage: 34, interval: 0.32, magSize: 0, auto: false },
  pistol: { name: 'Harbor Pistol', slot: 1, damage: 34, interval: 0.24, magSize: 12, speed: 720, auto: false },
  smg: { name: 'Calle SMG', slot: 2, damage: 16, interval: 0.085, magSize: 30, speed: 760, auto: true },
  shotgun: { name: 'Dockside Shotgun', slot: 3, damage: 17, pellets: 6, interval: 0.5, magSize: 6, speed: 680, auto: false },
  grenade: { name: 'Grenade', slot: 4, damage: 95, interval: 0.5, magSize: 0, auto: false },
};

export const SLOT_ORDER = ['pistol', 'smg', 'shotgun', 'grenade', 'fists'];

export const WEAPON_SHOP_ITEMS = [
  { key: 'pistol', label: 'Harbor Pistol', price: 180 },
  { key: 'smg', label: 'Calle SMG', price: 420 },
  { key: 'shotgun', label: 'Dockside Shotgun', price: 350 },
  { key: 'grenades', label: 'Grenades x3', price: 90 },
  { key: 'ammoLight', label: 'Pistol + SMG ammo', price: 40 },
  { key: 'ammoShells', label: 'Shotgun shells', price: 35 },
  { key: 'health', label: 'Field dressing (full health)', price: 60 },
  { key: 'armor', label: 'Kevlar vest', price: 150 },
];

export const GARAGE_ITEMS = [
  { key: 'engine', label: 'Engine tune (+18% pace)', price: 300 },
  { key: 'plating', label: 'Body plating (half crash damage)', price: 350 },
  { key: 'repair', label: 'Full repair', price: 150 },
  { key: 'respray', label: 'Respray (fresh colour)', price: 100 },
];

export function defaultAmmo() {
  return {
    pistol: { mag: 0, reserve: 0 },
    smg: { mag: 0, reserve: 0 },
    shotgun: { mag: 0, reserve: 0 },
    grenade: { mag: 0, reserve: 0 },
  };
}

export function switchWeapon(game, id) {
  if (!WEAPONS[id]) return false;
  if (id !== 'fists' && !game.weaponsOwned[id]) return false;
  game.player.weapon = id;
  game.player.reloadT = 0;
  return true;
}

function fireOne(game, from, angle, spec, owner) {
  const spread = spec.pellets ? (Math.random() - 0.5) * 0.16 : (Math.random() - 0.5) * 0.03;
  const a = angle + spread;
  game.projectiles.push({
    x: from.x + Math.sin(angle) * 14,
    y: from.y - Math.cos(angle) * 14,
    vx: Math.sin(a) * spec.speed,
    vy: -Math.cos(a) * spec.speed,
    life: 0.85,
    damage: spec.damage,
    owner,
  });
}

export function spawnEnemyShot(game, enemy, spec) {
  fireOne(game, enemy, enemy.angle, spec, 'enemy');
}

// One attack tick for Rio. Edge-triggered weapons read the drained
// pressed set through `attackEdge`; the SMG reads the held key.
export function updatePlayerAttack(game, dt, attackEdge, attackHeld) {
  const p = game.player;
  p.fireT = Math.max(0, p.fireT - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) finishReload(game);
    return;
  }
  if (p.car) return;
  const id = p.weapon || 'fists';
  const spec = WEAPONS[id];
  if (id === 'fists') {
    if (attackEdge) game.tryPunchNow?.();
    return;
  }
  const ammo = game.ammo[id];
  if (!ammo) return;
  if (id === 'grenade') {
    if (attackEdge && ammo.mag > 0 && p.fireT <= 0) {
      ammo.mag--;
      p.fireT = spec.interval;
      const fx = Math.sin(p.angle), fy = -Math.cos(p.angle);
      game.grenades.push({
        x: p.x + fx * 16, y: p.y + fy * 16,
        vx: fx * 300, vy: fy * 300,
        fuse: 0.75,
      });
      game.audio?.throw?.();
    }
    return;
  }
  const wantFire = spec.auto ? attackHeld : attackEdge;
  if (!wantFire || p.fireT > 0) return;
  if (ammo.mag <= 0) {
    p.fireT = 0.25;
    startReload(game);
    return;
  }
  ammo.mag--;
  p.fireT = spec.interval;
  const shots = spec.pellets || 1;
  for (let i = 0; i < shots; i++) fireOne(game, p, p.angle, spec, 'player');
  game.audio?.shoot?.(id);
  addHeat(CRIME_HEAT.gunshot, game);
  // Muzzle particles.
  for (let i = 0; i < 3; i++) game.spawnParticle(p.x + Math.sin(p.angle) * 18, p.y - Math.cos(p.angle) * 18, '#ffd166');
}

export function startReload(game) {
  const p = game.player;
  const id = p.weapon;
  const spec = WEAPONS[id];
  if (!spec || !spec.magSize) return false;
  const ammo = game.ammo[id];
  if (!ammo || ammo.reserve <= 0 || ammo.mag >= spec.magSize || p.reloadT > 0) return false;
  p.reloadT = 0.9;
  game.audio?.reload?.();
  return true;
}

function finishReload(game) {
  const p = game.player;
  const spec = WEAPONS[p.weapon];
  if (!spec || !spec.magSize) return;
  const ammo = game.ammo[p.weapon];
  const need = spec.magSize - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  ammo.mag += take;
  ammo.reserve -= take;
}

export function updateGrenades(game, dt) {
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const g = game.grenades[i];
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vx *= 0.94; g.vy *= 0.94;
    g.fuse -= dt;
    if (g.fuse <= 0) {
      game.grenades.splice(i, 1);
      explodeAt(game, g.x, g.y, 95, 'player');
    }
  }
}

export function explodeAt(game, x, y, damage, owner) {
  game.audio?.explosion?.();
  game.shake = Math.min(16, (game.shake || 0) + 8);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 190;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
      color: ['#ffb347', '#ff5e3a', '#ffd166', '#8d99ae'][i % 4],
      size: 3 + Math.random() * 4,
    });
  }
  const R = 92;
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < R) hurtEnemy(game, e, damage * (1 - d / (R * 1.6)));
  }
  for (const ped of game.peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < R && ped.state !== 'down') { ped.state = 'down'; ped.downT = 4; ped.health -= 60; }
  }
  for (const m of game.crew) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < R && m.state !== 'down') hurtCrew(game, m, damage * 0.5);
  }
  const pd = Math.hypot(game.player.x - x, game.player.y - y);
  if (pd < R && owner !== 'player') game.hurtPlayer?.(damage * 0.6 * (1 - pd / (R * 1.5)));
  if (pd < R && owner === 'player' && pd < 34) game.hurtPlayer?.(damage * 0.25);
  for (const car of [...game.cars, ...game.policeRef.cars]) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < R + 20 && !car.wrecked) damageCar(game, car, damage * (1 - d / (R * 2)));
  }
}

export function damageCar(game, car, amount) {
  if (car.wrecked) return;
  car.damage += car.plated ? amount * 0.5 : amount;
  if (car.damage >= 120 && car.explodeT <= 0) {
    car.explodeT = 0.4; // cook-off delay — neighbours can chain
  }
}

export function updateCarExplosions(game, dt) {
  const all = [...game.cars, ...game.policeRef.cars];
  for (const car of all) {
    if (car.explodeT > 0 && !car.wrecked) {
      car.explodeT -= dt;
      if (car.explodeT <= 0) {
        car.wrecked = true;
        car.speed = 0;
        if (game.player.car === car) {
          const p = game.player;
          p.car = null;
          p.x = car.x + 34; p.y = car.y;
          game.hurtPlayer?.(18);
        }
        explodeAt(game, car.x, car.y, 80, 'env');
      }
    }
  }
}

export function hurtEnemy(game, e, amount) {
  if (e.state === 'down') return;
  e.health -= amount;
  if (e.health <= 0) {
    e.state = 'down';
    e.downT = 999;
    game.enemiesDown++;
    game.spawnHitParticles(e.x, e.y);
  }
}

export function hurtCrew(game, m, amount) {
  if (m.state === 'down') return;
  m.health -= amount;
  if (m.health <= 0) {
    m.health = 0;
    m.state = 'down';
    m.downT = 7;
  }
}

export function updateProjectiles(game, dt) {
  const p = game.player;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const pr = game.projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    let dead = pr.life <= 0 || collideRect(pr.x, pr.y, 2);
    if (!dead && pr.owner === 'player') {
      for (const e of game.enemies) {
        if (e.state === 'down') continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < 15) { hurtEnemy(game, e, pr.damage); dead = true; break; }
      }
      if (!dead) {
        for (const car of [...game.cars, ...game.policeRef.cars]) {
          if (car.wrecked) continue;
          if (Math.hypot(car.x - pr.x, car.y - pr.y) < 26) { damageCar(game, car, pr.damage * 0.4); dead = true; break; }
        }
      }
      if (!dead) {
        for (const ped of game.peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(ped.x - pr.x, ped.y - pr.y) < 12) {
            ped.state = 'down'; ped.downT = 3.5; ped.health -= pr.damage;
            addHeat(20, game);
            dead = true; break;
          }
        }
      }
    }
    if (!dead && pr.owner === 'enemy') {
      const target = p.car || p;
      const rr = p.car ? 27 : 13;
      if (Math.hypot(target.x - pr.x, target.y - pr.y) < rr) {
        if (p.car) damageCar(game, p.car, pr.damage * 0.3);
        else game.hurtPlayer?.(pr.damage);
        dead = true;
      }
      if (!dead) {
        for (const m of game.crew) {
          if (m.state === 'down' || m.inCar) continue;
          if (Math.hypot(m.x - pr.x, m.y - pr.y) < 12) { hurtCrew(game, m, pr.damage); dead = true; break; }
        }
      }
    }
    if (!dead && pr.owner === 'crew') {
      for (const e of game.enemies) {
        if (e.state === 'down') continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < 15) { hurtEnemy(game, e, pr.damage); dead = true; break; }
      }
    }
    if (dead) game.projectiles.splice(i, 1);
  }
}

// --- enemies -----------------------------------------------------------------

export function makeEnemy(x, y, kind) {
  const ferro = kind === 'ferro';
  return {
    x, y, angle: 0,
    health: ferro ? 85 : 55,
    maxHealth: ferro ? 85 : 55,
    state: 'active',
    downT: 0,
    kind: ferro ? 'ferro' : 'gunman',
    fireT: 0.6 + Math.random() * 0.9,
    burstLeft: 0,
    burstT: 0,
    speed: ferro ? 96 : 112,
  };
}

export function updateEnemies(game, dt) {
  const p = game.player;
  const targetPos = p.car || p;
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    const dx = targetPos.x - e.x, dy = targetPos.y - e.y;
    const d = Math.hypot(dx, dy);
    e.angle = Math.atan2(dx, -dy);
    if (d > 120) {
      e.x += Math.sin(e.angle) * e.speed * dt;
      e.y += -Math.cos(e.angle) * e.speed * dt;
    } else if (d < 52) {
      e.x -= Math.sin(e.angle) * e.speed * 0.5 * dt;
      e.y += Math.cos(e.angle) * e.speed * 0.5 * dt;
    }
    // Fire control: range plus a clear line past the buildings.
    e.fireT -= dt;
    if (e.burstT > 0) e.burstT -= dt;
    const canShoot = d < 300 && !lineBlocked(e.x, e.y, targetPos.x, targetPos.y);
    if (e.kind === 'ferro') {
      // Ferro fires three-round bursts, then pauses to re-acquire.
      if (e.burstLeft > 0 && e.burstT <= 0 && canShoot) {
        e.burstLeft--;
        e.burstT = 0.11;
        spawnEnemyShot(game, e, { damage: 7, speed: 700 });
        game.audio?.shoot?.('pistol');
      } else if (e.burstLeft <= 0 && e.fireT <= 0 && canShoot) {
        e.burstLeft = 3;
        e.burstT = 0;
        e.fireT = 1.5 + Math.random() * 0.7;
      }
    } else if (e.fireT <= 0 && canShoot) {
      e.fireT = 1.1 + Math.random() * 0.8;
      spawnEnemyShot(game, e, { damage: 6, speed: 680 });
      game.audio?.shoot?.('pistol');
    }
  }
}

// --- shops ---------------------------------------------------------------------

export function buyWeaponItem(game, idx) {
  const item = WEAPON_SHOP_ITEMS[idx];
  if (!item || game.cash < item.price) return false;
  const p = game.player;
  switch (item.key) {
    case 'pistol':
      if (game.weaponsOwned.pistol) return false;
      game.weaponsOwned.pistol = true;
      game.ammo.pistol = { mag: 12, reserve: 48 };
      break;
    case 'smg':
      if (game.weaponsOwned.smg) return false;
      game.weaponsOwned.smg = true;
      game.ammo.smg = { mag: 30, reserve: 90 };
      break;
    case 'shotgun':
      if (game.weaponsOwned.shotgun) return false;
      game.weaponsOwned.shotgun = true;
      game.ammo.shotgun = { mag: 6, reserve: 24 };
      break;
    case 'grenades':
      game.ammo.grenade.mag += 3;
      game.weaponsOwned.grenade = true;
      break;
    case 'ammoLight':
      if (!game.weaponsOwned.pistol && !game.weaponsOwned.smg) return false;
      game.ammo.pistol.reserve += 48;
      game.ammo.smg.reserve += 60;
      break;
    case 'ammoShells':
      if (!game.weaponsOwned.shotgun) return false;
      game.ammo.shotgun.reserve += 18;
      break;
    case 'health':
      if (p.health >= PLAYER.maxHealth) return false;
      p.health = PLAYER.maxHealth;
      break;
    case 'armor':
      if (p.armor >= PLAYER.maxArmor) return false;
      p.armor = PLAYER.maxArmor;
      break;
    default:
      return false;
  }
  game.cash -= item.price;
  game.audio?.cashRegister?.();
  return true;
}

export function buyGarageItem(game, idx) {
  const item = GARAGE_ITEMS[idx];
  if (!item || game.cash < item.price) return false;
  const car = game.player.car;
  if (!car) return false;
  switch (item.key) {
    case 'engine':
      if (game.mods.engine) return false;
      game.mods.engine = true;
      car.tuned = true;
      break;
    case 'plating':
      if (game.mods.plating) return false;
      game.mods.plating = true;
      car.plated = true;
      break;
    case 'repair':
      if (car.damage <= 0 && !car.wrecked) return false;
      car.damage = 0;
      car.wrecked = false;
      break;
    case 'respray': {
      const palette = ['#c94f6d', '#e07a3f', '#4f7dc9', '#f2d24b', '#7bf1a8', '#b388ff'];
      car.color = palette[Math.floor(Math.random() * palette.length)];
      break;
    }
    default:
      return false;
  }
  game.cash -= item.price;
  game.audio?.cashRegister?.();
  return true;
}

export { lineBlocked, PLAYER as _PLAYER, clamp as _clamp };
