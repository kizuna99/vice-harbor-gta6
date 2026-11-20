// police.js — the Serena Police Department: one heat score, five stars of
// response. Cruisers hunt on the road grid, officers close in on foot, Air
// One joins at three stars with a searchlight, and at four stars the
// department stops chasing and starts blocking the road ahead instead.

import { HEAT_LEVELS, AVENUES, STREETS } from './config.js';
import { angleTo, clamp, dirFrom } from './random.js';

export function createPolice() {
  return {
    heat: 0,
    stars: 0,
    cars: [],       // cruisers: {x,y,angle,speed,roadblock,wrecked,hp}
    officers: [],   // {x,y,angle,speed}
    heli: null,     // {x,y,angle}
    spawnTimer: 0,
    blockTimer: 0,
    unseenTimer: 0,
  };
}

export function starsFor(heat) {
  let s = 0;
  for (let i = 0; i < HEAT_LEVELS.length; i++) if (heat >= HEAT_LEVELS[i]) s = i;
  return s;
}

function nearestRoadPoint(x, y, off) {
  // Snap a spawn to the closest grid line so cruisers appear on asphalt.
  let best = { x, y }, bd = Infinity;
  for (const ax of AVENUES) { const d = Math.abs(ax - x); if (d < bd) { bd = d; best = { x: ax + off, y }; } }
  for (const sy of STREETS) { const d = Math.abs(sy - y); if (d < bd) { bd = d; best = { x, y: sy + off }; } }
  return best;
}

function spawnCruiser(game, roadblock, aheadAngle) {
  const pol = game.policeRef;
  const p = game.player;
  let x, y;
  if (roadblock) {
    const d = dirFrom(aheadAngle);
    x = p.x + d.x * 300;
    y = p.y + d.y * 300;
    const snap = nearestRoadPoint(x, y, 0);
    x = snap.x; y = snap.y;
  } else {
    const ang = Math.random() * Math.PI * 2;
    const snap = nearestRoadPoint(p.x + Math.sin(ang) * 620, p.y - Math.cos(ang) * 620, 14);
    x = snap.x; y = snap.y;
  }
  pol.cars.push({
    x, y, angle: angleTo(x, y, p.x, p.y), speed: 0,
    roadblock: !!roadblock, wrecked: false, hp: 160, type: 'cruiser',
    color: '#e8ecf2', police: true, driver: true, parked: false, airZ: 0, vz: 0, damage: 0,
  });
}

export function clearPolice(game) {
  const pol = game.policeRef;
  pol.cars.length = 0;
  pol.officers.length = 0;
  pol.heli = null;
  pol.blockTimer = 0;
  game.arrestFill = 0;
}

export function updatePolice(game, dt) {
  const pol = game.policeRef;
  const p = game.player;

  if (game.heatLock) pol.heat = game.heatLock;
  pol.stars = starsFor(pol.heat);
  const stars = pol.stars;

  // Nobody watching? Heat bleeds away after a grace period.
  let seen = false;
  if (stars > 0) {
    for (const c of pol.cars) if (Math.hypot(c.x - p.x, c.y - p.y) < 470 && !game.world.lineBlocked(c.x, c.y, p.x, p.y)) seen = true;
    for (const o of pol.officers) if (Math.hypot(o.x - p.x, o.y - p.y) < 380 && !game.world.lineBlocked(o.x, o.y, p.x, p.y)) seen = true;
    if (pol.heli) seen = true;
  }
  pol.unseenTimer = seen ? 0 : pol.unseenTimer + dt;
  if (!game.heatLock && pol.unseenTimer > 4 && pol.heat > 0) {
    pol.heat = Math.max(0, pol.heat - 3.2 * dt);
    pol.stars = starsFor(pol.heat);
  }

  // Strength on the ground scales with the stars.
  const wantCars = stars === 0 ? 0 : 1 + stars;
  const wantOfficers = stars >= 2 ? stars : 0;
  pol.spawnTimer -= dt;
  if (pol.spawnTimer <= 0) {
    pol.spawnTimer = 0.8;
    if (pol.cars.filter((c) => !c.roadblock).length < wantCars) spawnCruiser(game, false);
    if (pol.officers.length < wantOfficers) {
      const snap = nearestRoadPoint(p.x + 420, p.y + 260, 30);
      pol.officers.push({ x: snap.x, y: snap.y, angle: 0, speed: 0 });
    }
  }
  if (stars === 0) {
    // Everything stands down at once when the heat is gone.
    if (pol.cars.length) pol.cars.length = 0;
    if (pol.officers.length) pol.officers.length = 0;
    pol.heli = null;
  }

  // Roadblocks at four stars and up, on a seven-second placement cycle.
  pol.blockTimer -= dt;
  if (stars >= 4 && pol.blockTimer <= 0) {
    const heading = p.car ? p.car.angle : p.angle;
    spawnCruiser(game, true, heading);
    spawnCruiser(game, true, heading);
    pol.blockTimer = 7;
  }

  // Air One.
  if (stars >= 3) {
    if (!pol.heli) { pol.heli = { x: p.x - 300, y: p.y - 300, angle: 0 }; game.audio.sirenBurst(); }
    const h = pol.heli;
    const tx = p.x + Math.sin(game.time * 0.7) * 60;
    const ty = p.y + Math.cos(game.time * 0.55) * 60 - 40;
    h.x += (tx - h.x) * Math.min(1, dt * 1.6);
    h.y += (ty - h.y) * Math.min(1, dt * 1.6);
    h.angle += dt * 2.4;
  } else {
    pol.heli = null;
  }

  // Cruisers drive at the player; roadblocks hold their line.
  for (const c of pol.cars) {
    if (c.wrecked) continue;
    if (c.roadblock) { c.speed = 0; continue; }
    const want = angleTo(c.x, c.y, p.x, p.y);
    let d = want - c.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    c.angle += clamp(d, -2.4 * dt, 2.4 * dt);
    const distP = Math.hypot(p.x - c.x, p.y - c.y);
    const target = distP > 60 ? 252 : 0;
    c.speed += clamp(target - c.speed, -260 * dt, 190 * dt);
    const dir = dirFrom(c.angle);
    let nx = c.x + dir.x * c.speed * dt;
    let ny = c.y + dir.y * c.speed * dt;
    const fixed = game.world.collide(nx, ny, 20);
    c.x = fixed.x; c.y = fixed.y;
  }

  // Officers run the last stretch on foot and make the arrest.
  let arresting = false;
  for (const o of pol.officers) {
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    o.angle = angleTo(o.x, o.y, p.x, p.y);
    if (d > 30) {
      const dir = dirFrom(o.angle);
      const nx = o.x + dir.x * 148 * dt;
      const ny = o.y + dir.y * 148 * dt;
      const fixed = game.world.collide(nx, ny, 12);
      o.x = fixed.x; o.y = fixed.y;
    } else if (!p.car) {
      arresting = true;
    }
  }
  if (!p.car) {
    for (const c of pol.cars) {
      if (!c.roadblock && Math.hypot(c.x - p.x, c.y - p.y) < 48) arresting = true;
    }
  }
  const playerSlow = !p.car || Math.abs(p.car.speed) < 26;
  if (arresting && playerSlow && stars > 0) {
    game.arrestFill = Math.min(1, game.arrestFill + dt / 1.7);
    if (game.arrestFill >= 1) game.busted();
  } else {
    game.arrestFill = Math.max(0, game.arrestFill - dt * 0.7);
  }
}
