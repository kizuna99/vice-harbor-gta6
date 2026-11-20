// Crew: Vex and Mara, recruited at the Old Town safehouse once Rio
// has the respect for it. They follow on foot, ride along in cars,
// shoot alongside Rio, can be downed and get revived at his side.
// C toggles the whole crew between follow and stay.

import { SAFEHOUSE } from './config.js';
import { resolveCollision, lineBlocked } from './world.js';

export const CREW_DEFS = [
  { name: 'Vex', respect: 30, shirt: '#56b6c2', skin: '#c68642', speed: 238 },
  { name: 'Mara', respect: 70, shirt: '#b388ff', skin: '#f1c27d', speed: 228 },
];

export function makeCrewMember(def, x, y) {
  return {
    name: def.name,
    x, y, angle: 0,
    health: 100,
    maxHealth: 100,
    state: 'follow', // follow | stay | down
    mode: 'follow',
    inCar: false,
    fireT: 0.8,
    downT: 0,
    reviveT: 0,
    shirt: def.shirt,
    skin: def.skin,
    speed: def.speed,
    walkCycle: 0,
  };
}

export function recruitable(game) {
  for (const def of CREW_DEFS) {
    if (game.respect < def.respect) continue;
    if (game.crew.some((m) => m.name === def.name)) continue;
    return def;
  }
  return null;
}

export function tryRecruit(game) {
  const p = game.player;
  if (p.car) return null;
  if (Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) > SAFEHOUSE.radius) return null;
  const def = recruitable(game);
  if (!def) return null;
  const member = makeCrewMember(def, p.x + 26, p.y + 10);
  game.crew.push(member);
  game.showBanner?.(`${def.name} joins the crew. C toggles follow / stay.`, 4);
  game.audio?.pickup?.();
  game.save();
  return member;
}

export function toggleCrewMode(game) {
  if (!game.crew.length) return;
  const next = game.crew[0].mode === 'follow' ? 'stay' : 'follow';
  for (const m of game.crew) {
    m.mode = next;
    if (m.state !== 'down') m.state = next;
  }
  game.showBanner?.(`Crew: ${next === 'follow' ? 'follow me' : 'hold position'}`, 2);
}

export function updateCrew(game, dt) {
  const p = game.player;
  game.crew.forEach((m, i) => {
    if (m.state === 'down') {
      m.downT -= dt;
      // Rio standing close revives; otherwise they crawl back up.
      const near = Math.hypot(p.x - m.x, p.y - m.y) < 44 && !p.car;
      m.reviveT = near ? m.reviveT + dt : 0;
      if (m.reviveT > 1.2 || m.downT <= 0) {
        m.state = m.mode;
        m.health = 45;
        m.reviveT = 0;
      }
      return;
    }

    if (p.car) {
      // Ride along: hop in when close, materialise beside the car
      // when Rio gets out (handled by the else branch next tick).
      m.inCar = true;
      m.x = p.car.x;
      m.y = p.car.y;
      return;
    }
    if (m.inCar) {
      m.inCar = false;
      m.x = p.x + 24 + i * 14;
      m.y = p.y + 8;
    }

    if (m.mode === 'stay') { m.walkCycle = 0; combat(game, m, dt); return; }

    // Formation slot trails Rio, offset per member.
    const back = 36 + i * 20;
    const tx = p.x - Math.sin(p.angle) * back + (i === 1 ? 20 : -6);
    const ty = p.y + Math.cos(p.angle) * back;
    const dx = tx - m.x, dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    if (d > 26) {
      m.angle = Math.atan2(dx, -dy);
      const sp = d > 120 ? m.speed : Math.max(90, Math.min(m.speed, d * 3.2));
      m.x += Math.sin(m.angle) * sp * dt;
      m.y += -Math.cos(m.angle) * sp * dt;
      m.walkCycle += dt * 11;
      resolveCollision(m, 10);
    } else {
      m.walkCycle = 0;
      m.angle = p.angle;
    }
    combat(game, m, dt);
  });
}

function combat(game, m, dt) {
  m.fireT -= dt;
  if (m.fireT > 0 || m.inCar) return;
  let best = null, bd = 300;
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    const d = Math.hypot(e.x - m.x, e.y - m.y);
    if (d < bd && !lineBlocked(m.x, m.y, e.x, e.y)) { best = e; bd = d; }
  }
  if (!best) return;
  m.fireT = 0.55 + Math.random() * 0.3;
  m.angle = Math.atan2(best.x - m.x, -(best.y - m.y));
  game.projectiles.push({
    x: m.x + Math.sin(m.angle) * 13,
    y: m.y - Math.cos(m.angle) * 13,
    vx: Math.sin(m.angle) * 720,
    vy: -Math.cos(m.angle) * 720,
    life: 0.8,
    damage: 15,
    owner: 'crew',
  });
  game.audio?.shoot?.('pistol');
}
