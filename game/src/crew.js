// The crew: respect made flesh. Rio's reputation unlocks up to two
// allied runners waiting at the Old Town safehouse — Vex at 30
// respect, Mara at 70. They follow on foot, pile into Rio's car when
// he drives, and shoot his fights with him using the same projectile
// system as the Ferro crew. C toggles follow / stay.

import { range } from './random.js';
import { resolveCollision, segmentBlocked } from './world.js';
import { police } from './police.js';
import { fireBullet } from './weapons.js';
import { showMessage } from './missions.js';

export const SAFEHOUSE = { x: 200, y: 340 };
export const CREW_UNLOCKS = [30, 70];
const NAMES = ['Vex', 'Mara'];
const SHIRTS = ['#7c5cd6', '#2e9e6b'];
const GUN = { damage: 11, speed: 580, spread: 0.06, range: 340 };

export function makeCrewMember(name, x, y) {
  const i = Math.max(0, NAMES.indexOf(name));
  return {
    name, x, y, angle: 0, health: 80,
    state: 'follow', // follow | stay | down
    inCar: false, reviveT: 0,
    fireT: range(0.5, 1.5), burst: 0, burstT: 0, walkCycle: 0,
    shirt: SHIRTS[i % SHIRTS.length], skin: '#e0ac69',
  };
}

export function canRecruit(game) {
  const p = game.player;
  if (p.car || game.crew.length >= NAMES.length) return false;
  return Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) < 70;
}

export function tryRecruit(game) {
  if (!canRecruit(game)) {
    // A hint when Rio is close but not respected enough yet.
    const p = game.player;
    if (!p.car && game.crew.length < NAMES.length
      && Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) < 70 && game.hintT <= 0) {
      showMessage(game, `Nobody here runs with a stranger. Crew unlocks at ${CREW_UNLOCKS[game.crew.length]} respect.`, 3);
      game.hintT = 5;
    }
    return false;
  }
  const need = CREW_UNLOCKS[game.crew.length];
  if (game.respect < need) {
    if (game.hintT <= 0) {
      showMessage(game, `The safehouse crew wants ${need} respect before they ride. You have ${game.respect}.`, 3);
      game.hintT = 5;
    }
    return false;
  }
  const p = game.player;
  const m = makeCrewMember(NAMES[game.crew.length], p.x + 22, p.y + 16);
  game.crew.push(m);
  game.audio?.checkpoint();
  showMessage(game, `${m.name} joins the crew. C toggles follow / stay.`, 4);
  game.save();
  return true;
}

export function toggleCrew(game) {
  if (!game.crew.length) return;
  const stay = game.crew.some((m) => m.state === 'follow');
  for (const m of game.crew) if (m.state !== 'down') m.state = stay ? 'stay' : 'follow';
  showMessage(game, stay ? 'Crew: hold this ground.' : 'Crew: on me.', 1.8);
}

function moveToward(m, tx, ty, dt, speed) {
  const dx = tx - m.x, dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return d;
  m.angle = Math.atan2(dx, -dy);
  m.walkCycle += dt * 10;
  const step = Math.min(d, speed * dt);
  m.x += (dx / d) * step;
  m.y += (dy / d) * step;
  resolveCollision(m, 10);
  return d;
}

export function updateCrew(game, dt) {
  const p = game.player;
  game.crew.forEach((m, idx) => {
    if (m.state === 'down') {
      m.reviveT -= dt;
      if (m.reviveT <= 0) {
        m.health = 40; m.state = 'follow';
        m.x = p.x + 26; m.y = p.y + 20;
        showMessage(game, `${m.name} is back on their feet.`, 2.4);
      }
      return;
    }
    if (p.car) {
      if (m.inCar) { m.x = p.car.x; m.y = p.car.y; return; }
      const d = Math.hypot(p.car.x - m.x, p.car.y - m.y);
      if (d > 760) { m.x = p.car.x - 40; m.y = p.car.y + 30; }
      else if (moveToward(m, p.car.x, p.car.y, dt, 268) < 36) m.inCar = true;
      return;
    }
    if (m.inCar) {
      m.inCar = false;
      m.x = p.x + (idx === 0 ? -24 : 24); m.y = p.y + 18;
    }
    if (m.state === 'follow') {
      const lx = idx === 0 ? -24 : 24, ly = -20;
      const ax = p.x + Math.cos(p.angle) * lx + Math.sin(p.angle) * ly;
      const ay = p.y + Math.sin(p.angle) * lx - Math.cos(p.angle) * ly;
      const d = Math.hypot(ax - m.x, ay - m.y);
      if (d > 24) moveToward(m, ax, ay, dt, d > 170 ? 268 : 205);
    }
    // Fight: nearest Ferro standing, else the law while Rio is hot.
    let target = null, bestD = 330;
    for (const e of game.enemies) {
      if (e.state === 'down') continue;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d < bestD && !segmentBlocked(m.x, m.y, e.x, e.y)) { target = e; bestD = d; }
    }
    if (!target && police.stars > 0) {
      for (const o of police.officers) {
        if (o.state === 'down') continue;
        const d = Math.hypot(o.x - m.x, o.y - m.y);
        if (d < bestD && !segmentBlocked(m.x, m.y, o.x, o.y)) { target = o; bestD = d; }
      }
      if (!target) {
        for (const c of police.cars) {
          const d = Math.hypot(c.x - m.x, c.y - m.y);
          if (d < bestD && !segmentBlocked(m.x, m.y, c.x, c.y)) { target = c; bestD = d; }
        }
      }
    }
    if (target) {
      m.angle = Math.atan2(target.x - m.x, -(target.y - m.y));
      if (m.burst > 0) {
        m.burstT -= dt;
        if (m.burstT <= 0) {
          m.burst--; m.burstT = 0.12;
          fireBullet(game, m, m.angle, GUN, false);
          game.audio?.enemyShoot();
        }
      } else {
        m.fireT -= dt;
        if (m.fireT <= 0) { m.burst = 3; m.burstT = 0; m.fireT = range(1.4, 2.3); }
      }
    }
  });
}
