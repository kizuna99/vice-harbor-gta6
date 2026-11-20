// Port Serena's static layout: avenues, buildings, beach, pier,
// props and the four stunt ramps. Pure data built once at boot.

import { WORLD, DISTRICTS } from './config.js';
import { makeRng } from './random.js';

export const world = {
  buildings: [],
  colliders: [],
  palms: [],
  lamps: [],
  props: [],
  ramps: [],
  roadsX: [],
  roadsY: [],
  beach: null,
  ocean: null,
  pier: null,
  islet: null,
  spawn: { x: 1250, y: 420 },
};

const NAMES = [
  'Cafe Serena', 'Hotel Palma', 'Bea\'s Kitchen', 'Neon Arcade', 'Marina Books',
  'Sunset Laundry', 'Pier Nine Diner', 'Harbor Bank', 'Lulu\'s Records',
  'Dockside Gym', 'Coral Pharmacy', 'Vista Apartments', 'Old Town Hall',
  'University Library', 'Lecture Hall B', 'Student Union', 'Tide Gallery',
  'Boardwalk Fries', 'Shell Shop', 'Ferry Office', 'Customs House',
  'Crane Yard Office', 'Warehouse 4', 'Warehouse 7', 'Cold Storage',
  'Serena Munitions', 'Serena Customs',
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  if (y >= 1650) return DISTRICTS[4];
  return DISTRICTS[0];
}

function isOnRoad(x, y, pad) {
  const half = WORLD.roadWidth / 2 + (pad || 0);
  for (const rx of world.roadsX) if (Math.abs(x - rx) < half) return true;
  for (const ry of world.roadsY) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function buildWorld() {
  const rng = makeRng(777);
  world.buildings.length = 0;
  world.colliders.length = 0;
  world.palms.length = 0;
  world.lamps.length = 0;
  world.props.length = 0;
  world.ramps.length = 0;

  world.roadsX = [];
  world.roadsY = [];
  for (let x = 200; x < WORLD.width; x += WORLD.roadGap) world.roadsX.push(x);
  for (let y = 200; y < 1700; y += WORLD.roadGap) world.roadsY.push(y);
  world.roadsY.push(1560); // Ocean Drive

  world.beach = { x: 0, y: 1650, w: WORLD.width, h: 190 };
  world.ocean = { x: 0, y: 1840, w: WORLD.width, h: WORLD.height - 1840 };
  world.pier = { x: 2380, y: 1650, w: 90, h: 420 };
  world.islet = { x: 620, y: 2050, w: 340, h: 150 };

  // Stunt ramps sit squarely on avenues. The first one is on the
  // eastbound run at y=600, a short drive east of x=1120.
  world.ramps.push(
    { x: 1245, y: 600, w: 84, h: 92 },
    { x: 2000, y: 200, w: 84, h: 92 },
    { x: 1000, y: 1400, w: 84, h: 92 },
    { x: 2800, y: 1000, w: 84, h: 92 },
  );

  let nameIdx = 0;
  const block = WORLD.blockSize;
  for (let bx = 0; bx < WORLD.width - 100; bx += WORLD.roadGap) {
    for (let by = 0; by < 1500; by += WORLD.roadGap) {
      const ox = bx + WORLD.roadWidth / 2 + 14;
      const oy = by + WORLD.roadWidth / 2 + 14;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (rng() < 0.16) continue;
          const w = 110 + rng() * 30;
          const h = 110 + rng() * 30;
          const x = ox + i * (block / 2) + 6;
          const y = oy + j * (block / 2) + 6;
          if (isOnRoad(x + w / 2, y + h / 2, 30)) continue;
          const d = districtAt(x + w / 2, y + h / 2);
          const named = rng() < 0.3;
          const b = {
            x, y, w, h,
            hue: Math.floor(rng() * 360),
            floors: 2 + Math.floor(rng() * 5),
            seed: Math.floor(rng() * 100000),
            district: d.id,
            name: named ? NAMES[nameIdx++ % NAMES.length] : null,
          };
          world.buildings.push(b);
          world.colliders.push({ x, y, w, h });
        }
      }
    }
  }

  for (let i = 0; i < 150; i++) {
    const x = rng() * WORLD.width;
    const y = 150 + rng() * 1550;
    if (isOnRoad(x, y, 12)) continue;
    world.palms.push({ x, y, s: 0.8 + rng() * 0.6, lean: (rng() - 0.5) * 0.4 });
  }
  for (const rx of world.roadsX) {
    for (const ry of world.roadsY) {
      world.lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y: ry + WORLD.roadWidth / 2 + 8 });
    }
  }
  for (let i = 0; i < 36; i++) {
    const x = 2150 + rng() * 950;
    const y = 950 + rng() * 620;
    if (isOnRoad(x, y, 26)) continue;
    const crate = { x, y, w: 34 + rng() * 26, h: 22 + rng() * 14, hue: Math.floor(rng() * 360) };
    world.props.push(crate);
    world.colliders.push({ x: crate.x, y: crate.y, w: crate.w, h: crate.h });
  }
  world.colliders.push({ x: world.pier.x - 14, y: world.pier.y, w: 14, h: world.pier.h });
  world.colliders.push({ x: world.pier.x + world.pier.w, y: world.pier.y, w: 14, h: world.pier.h });
  return world;
}

export function collideRect(px, py, r) {
  for (const c of world.colliders) {
    if (px + r > c.x && px - r < c.x + c.w && py + r > c.y && py - r < c.y + c.h) return true;
  }
  return false;
}

// Segment vs buildings, sampled — used for gunfire line-of-sight.
export function lineBlocked(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.floor(d / 16));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (collideRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 3)) return true;
  }
  return false;
}

export function resolveCollision(ent, r) {
  for (const c of world.colliders) {
    const nx = Math.max(c.x, Math.min(ent.x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(ent.y, c.y + c.h));
    const dx = ent.x - nx;
    const dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      if (d2 === 0) { ent.y = c.y - r - 1; continue; }
      const push = (r - d) / d;
      ent.x += dx * push;
      ent.y += dy * push;
    }
  }
  ent.x = Math.max(r, Math.min(WORLD.width - r, ent.x));
  ent.y = Math.max(r, Math.min(1836 - r, ent.y));
}

export function nearestRoadPoint(x, y) {
  let best = { x, y, d: Infinity };
  for (const rx of world.roadsX) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { x: rx, y, d };
  }
  for (const ry of world.roadsY) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { x, y: ry, d };
  }
  return best;
}

export { isOnRoad };
