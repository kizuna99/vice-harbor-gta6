// Port Serena world definition.
// Builds the road network, building footprints, beach, pier and props
// from the district table. Pure data — no rendering happens here.

import { WORLD, DISTRICTS } from './config.js';
import { makeRng, pick } from './random.js';

export const world = {
  buildings: [],   // {x,y,w,h,hue,name?,district}
  colliders: [],   // solid AABBs the player and cars respect
  palms: [],
  lamps: [],
  props: [],
  roadsX: [],      // vertical avenue centre lines
  roadsY: [],      // horizontal street centre lines
  beach: null,
  ocean: null,
  pier: null,
  islet: null,
  spawn: { x: 1250, y: 420 },
};

const BUILDING_NAMES = [
  'Cafe Serena', 'Hotel Palma', 'Bea\'s Kitchen', 'Neon Arcade', 'Marina Books',
  'Sunset Laundry', 'Pier Nine Diner', 'Harbor Bank', 'Lulu\'s Records',
  'Dockside Gym', 'Coral Pharmacy', 'Vista Apartments', 'Old Town Hall',
  'University Library', 'Lecture Hall B', 'Student Union', 'Tide Gallery',
  'Boardwalk Fries', 'Shell Shop', 'Ferry Office', 'Customs House',
  'Crane Yard Office', 'Warehouse 4', 'Warehouse 7', 'Cold Storage',
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  // South strip is beach / boardwalk edge.
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

  // Avenue / street centre lines.
  world.roadsX = [];
  world.roadsY = [];
  for (let x = 200; x < WORLD.width; x += WORLD.roadGap) world.roadsX.push(x);
  for (let y = 200; y < 1700; y += WORLD.roadGap) world.roadsY.push(y);
  // Ocean Drive runs along the beach.
  world.roadsY.push(1560);

  // Water + sand along the southern edge.
  world.beach = { x: 0, y: 1650, w: WORLD.width, h: 190 };
  world.ocean = { x: 0, y: 1840, w: WORLD.width, h: WORLD.height - 1840 };
  world.pier = { x: 2380, y: 1650, w: 90, h: 420 }; // Pier Nine
  world.islet = { x: 620, y: 2050, w: 340, h: 150 }; // causeway islet

  // Buildings: fill each block with 2x2 footprints, skipping some lots.
  let nameIdx = 0;
  const block = WORLD.blockSize;
  for (let bx = 0; bx < WORLD.width - 100; bx += WORLD.roadGap) {
    for (let by = 0; by < 1500; by += WORLD.roadGap) {
      const ox = bx + WORLD.roadWidth / 2 + 14;
      const oy = by + WORLD.roadWidth / 2 + 14;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (rng() < 0.16) continue; // empty lot / plaza
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
            district: d.id,
            name: named ? BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length] : null,
          };
          world.buildings.push(b);
          world.colliders.push({ x, y, w, h });
        }
      }
    }
  }

  // Palms cluster on Palm Row, the Boardwalk and the beach fringe.
  for (let i = 0; i < 150; i++) {
    const x = rng() * WORLD.width;
    const y = 150 + rng() * 1550;
    if (isOnRoad(x, y, 12)) continue;
    world.palms.push({ x, y, s: 0.8 + rng() * 0.6, lean: (rng() - 0.5) * 0.4 });
  }
  // Street lamps at intersections.
  for (const rx of world.roadsX) {
    for (const ry of world.roadsY) {
      world.lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y: ry + WORLD.roadWidth / 2 + 8 });
    }
  }
  // Dock props: crates and containers in the Port Docks.
  for (let i = 0; i < 36; i++) {
    const x = 2150 + rng() * 950;
    const y = 950 + rng() * 620;
    if (isOnRoad(x, y, 26)) continue;
    const crate = { x, y, w: 34 + rng() * 26, h: 22 + rng() * 14, hue: Math.floor(rng() * 360) };
    world.props.push(crate);
    world.colliders.push({ x: crate.x, y: crate.y, w: crate.w, h: crate.h });
  }
  // Pier is solid except its walkway spine.
  world.colliders.push({ x: world.pier.x - 14, y: world.pier.y, w: 14, h: world.pier.h });
  world.colliders.push({ x: world.pier.x + world.pier.w, y: world.pier.y, w: 14, h: world.pier.h });

  return world;
}

export function collideRect(px, py, r) {
  // Returns true when a circle at px,py with radius r hits a solid.
  for (const c of world.colliders) {
    if (px + r > c.x && px - r < c.x + c.w && py + r > c.y && py - r < c.y + c.h) return true;
  }
  return false;
}

export function resolveCollision(ent, r) {
  // Push an entity out of solids along the smallest penetration axis.
  for (const c of world.colliders) {
    const nx = Math.max(c.x, Math.min(ent.x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(ent.y, c.y + c.h));
    const dx = ent.x - nx;
    const dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) / d;
      if (d2 === 0) { ent.y = c.y - r - 1; continue; }
      ent.x += dx * push;
      ent.y += dy * push;
    }
  }
  // Keep everyone inside the map and out of deep water.
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

export { isOnRoad, pick };
