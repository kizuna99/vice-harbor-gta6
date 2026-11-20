// combat.js — everything that hurts: bullets in flight, thrown
// grenades, explosions and the fires they start, and the dock gunmen
// who shoot back in bursts when they have a clean line. Cars that take
// too much damage cook off and chain into their neighbours.

import { ARMOR_ABSORB } from './config.js';
import { losClear, collideCircle } from './world.js';
import { Audio } from './audio.js';
import { rngRange } from './random.js';

export function burst(game, x, y, n, colour, speed = 130, size = 3.4, life = 0.7) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rngRange(Math.random, speed * 0.3, speed);
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rngRange(Math.random, life * 0.4, life), max: life, size: rngRange(Math.random, size * 0.5, size), color: colour, grav: 0 });
  }
  if (game.particles.length > 520) game.particles.splice(0, game.particles.length - 520);
}

export function damagePlayer(game, dmg) {
  const p = game.player;
  if (game.state !== 'playing') return;
  let rest = dmg;
  if (p.armor > 0) {
    const soaked = Math.min(p.armor, dmg * ARMOR_ABSORB);
    p.armor -= soaked;
    rest = dmg - soaked;
  }
  p.health -= rest;
  if (p.health <= 0) { p.health = 0; game.wasted(); }
}

export function explode(game, x, y, radius, dmg) {
  Audio.explosion();
  game.shake = Math.max(game.shake, 7);
  burst(game, x, y, 20, '#ffb347', 240, 4.4, 0.8);
  burst(game, x, y, 12, '#e2483d', 170, 3.6, 1.0);
  burst(game, x, y, 10, '#555c66', 60, 6, 1.7);
  game.threat = { x, y, t: 5 };
  const hit = (e, r) => {
    const d = Math.hypot(e.x - x, e.y - y);
    return d < radius + r ? dmg * Math.max(0.25, 1 - d / (radius + r)) : 0;
  };
  const pd = hit(game.player, 14);
  if (pd > 0 && !game.player.car) damagePlayer(game, pd);
  if (pd > 0 && game.player.car) game.player.car.damage += pd * 0.7;
  for (const e of game.enemies) if (e.state !== 'down') { const d = hit(e, 15); if (d > 0) e.health -= d; }
  for (const ped of game.peds) { const d = hit(ped, 11); if (d > 0) { ped.state = 'flee'; ped.fleeT = 6; } }
  for (const o of game.policeRef.officers) { const d = hit(o, 12); if (d > 0) o.dead = true; }
  for (const car of [...game.cars, ...game.policeRef.cars]) {
    const d = hit(car, car.radius);
    if (d > 0) car.damage += d;
  }
  for (const ped of game.peds) if (Math.hypot(ped.x - x, ped.y - y) < 230) { ped.state = 'flee'; ped.fleeT = 5; }
}

export function spawnEnemy(game, x, y, weapon = 'pistol') {
  const e = {
    x, y, angle: 0, health: 40, state: 'fight', radius: 14,
    weapon, burstT: rngRange(Math.random, 0.3, 1.2), burstLeft: 0, shotT: 0,
    strafeDir: Math.random() < 0.5 ? -1 : 1, walkCycle: Math.random() * 6,
    colour: '#3a3f4a',
  };
  game.enemies.push(e);
  return e;
}

function enemyShoot(game, e) {
  const p = game.player;
  const a = Math.atan2(p.x - e.x, -(p.y - e.y)) + rngRange(Math.random, -0.085, 0.085);
  const speed = 640;
  game.projectiles.push({
    x: e.x + Math.sin(a) * 17, y: e.y - Math.cos(a) * 17,
    vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed,
    life: 0.62, dmg: 9, friendly: false, kind: 'enemy',
  });
  Audio.shot('pistol');
}

export function updateCombat(game, dt) {
  const p = game.player;

  // --- enemy gunmen -------------------------------------------------
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    if (e.health <= 0) {
      e.state = 'down';
      burst(game, e.x, e.y, 7, '#8c2f26', 90, 3, 0.6);
      continue;
    }
    const target = p.car || p;
    const dx = target.x - e.x, dy = target.y - e.y;
    const d = Math.hypot(dx, dy);
    e.angle = Math.atan2(dx, -dy);
    const clear = d < 380 && losClear(game.world, e.x, e.y, target.x, target.y);
    if (d > 165 || !clear) {
      e.x += (dx / (d || 1)) * 118 * dt;
      e.y += (dy / (d || 1)) * 118 * dt;
      e.walkCycle += dt * 8;
      collideCircle(game.world, e, e.radius);
    } else {
      // in range with a line: sidestep slowly, fire in bursts of three
      e.x += Math.cos(e.angle) * e.strafeDir * 26 * dt;
      e.y += Math.sin(e.angle) * e.strafeDir * 26 * dt;
      collideCircle(game.world, e, e.radius);
      e.burstT -= dt;
      if (e.burstT <= 0 && e.burstLeft === 0) { e.burstLeft = 3; e.shotT = 0; e.burstT = rngRange(Math.random, 0.95, 1.5); }
    }
    if (e.burstLeft > 0 && clear) {
      e.shotT -= dt;
      if (e.shotT <= 0) { enemyShoot(game, e); e.burstLeft--; e.shotT = 0.095; }
    } else if (e.burstLeft > 0 && !clear) e.burstLeft = 0;
    // keep gunmen off each other's toes
    for (const o of game.enemies) {
      if (o === e || o.state === 'down') continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy);
      if (sd < 30 && sd > 0.01) { e.x += (sx / sd) * 22 * dt; e.y += (sy / sd) * 22 * dt; }
    }
  }

  // --- projectiles ----------------------------------------------------
  const kept = [];
  for (const pr of game.projectiles) {
    const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
    pr.life -= dt;
    let dead = pr.life <= 0;
    if (!dead && !losClear(game.world, pr.x, pr.y, nx, ny)) {
      burst(game, nx, ny, 3, '#e8d9a0', 60, 2, 0.3);
      dead = true;
    }
    if (!dead) {
      if (pr.friendly) {
        for (const e of game.enemies) {
          if (e.state !== 'down' && Math.hypot(e.x - nx, e.y - ny) < 16) { e.health -= pr.dmg; burst(game, nx, ny, 3, '#8c2f26', 70, 2.4, 0.4); dead = true; break; }
        }
        if (!dead) for (const o of game.policeRef.officers) {
          if (Math.hypot(o.x - nx, o.y - ny) < 14) { o.dead = true; game.policeRef.addHeat(9); dead = true; break; }
        }
        if (!dead) for (const car of [...game.cars, ...game.policeRef.cars]) {
          if (!car.wrecked && Math.hypot(car.x - nx, car.y - ny) < car.radius) { car.damage += pr.dmg * 0.55; burst(game, nx, ny, 2, '#ffd23d', 80, 2, 0.3); dead = true; break; }
        }
        if (!dead) for (const ped of game.peds) {
          if (Math.hypot(ped.x - nx, ped.y - ny) < 12) { ped.state = 'flee'; ped.fleeT = 6; game.policeRef.addHeat(8); burst(game, nx, ny, 3, '#8c2f26', 70, 2.4, 0.4); dead = true; break; }
        }
      } else {
        const tp = p.car || p;
        if (Math.hypot(tp.x - nx, tp.y - ny) < (p.car ? p.car.radius : 14)) {
          if (p.car) p.car.damage += pr.dmg * 0.4; else damagePlayer(game, pr.dmg);
          burst(game, nx, ny, 3, '#8c2f26', 70, 2.4, 0.4);
          dead = true;
        }
        // crew stand in the same crossfire: hits wound them, and enough
        // wounds put them down until Rio comes back for them
        if (!dead) for (const m of game.crew) {
          if (m.state === 'down' || m.state === 'ride') continue;
          if (Math.hypot(m.x - nx, m.y - ny) < 14) {
            m.health -= pr.dmg;
            burst(game, nx, ny, 3, '#8c2f26', 70, 2.4, 0.4);
            if (m.health <= 0) { m.state = 'down'; m.downT = 0; game.toast(m.name + ' is down — get to them'); }
            dead = true;
            break;
          }
        }
      }
    }
    pr.x = nx; pr.y = ny;
    if (!dead) kept.push(pr);
  }
  game.projectiles = kept;
  game.policeRef.officers = game.policeRef.officers.filter((o) => !o.dead);

  // --- thrown grenades --------------------------------------------------
  const nades = [];
  for (const n of game.thrown) {
    n.x += n.vx * dt; n.y += n.vy * dt;
    n.vx *= Math.pow(0.12, dt); n.vy *= Math.pow(0.12, dt);
    n.fuse -= dt;
    if (n.fuse <= 0) explode(game, n.x, n.y, 118, 95);
    else nades.push(n);
  }
  game.thrown = nades;

  // --- wrecks cook off and chain ---------------------------------------
  for (const car of [...game.cars, ...game.policeRef.cars]) {
    if (car.wrecked) continue;
    // a car past two-thirds damage smokes hard before it cooks off —
    // the visible warning that a chain explosion is coming
    if (car.damage > 65 && car.exploding <= 0 && Math.random() < dt * 9) {
      burst(game, car.x + rngRange(Math.random, -8, 8), car.y - 8, 1, '#3c4148', 26, 5.4, 1.3);
    }
    if (car.damage >= 100 && car.exploding <= 0) car.exploding = 0.32;
    if (car.exploding > 0) {
      car.exploding -= dt;
      if (Math.random() < dt * 14) burst(game, car.x, car.y - 6, 2, '#ffb347', 60, 3.4, 0.5);
      if (car.exploding <= 0) {
        car.wrecked = true;
        car.speed = 0;
        explode(game, car.x, car.y, 104, 58);
        if (game.player.car === car) {
          game.player.car = null;
          game.player.x = car.x + 30; game.player.y = car.y;
          damagePlayer(game, 16);
        }
        if (car.police) game.policeRef.addHeat(6);
      }
    }
  }

  // --- particles ---------------------------------------------------------
  const parts = [];
  for (const pt of game.particles) {
    pt.life -= dt;
    if (pt.life <= 0) continue;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vy += (pt.grav || 0) * dt;
    parts.push(pt);
  }
  game.particles = parts;
  if (game.threat.t > 0) game.threat.t -= dt;
}
