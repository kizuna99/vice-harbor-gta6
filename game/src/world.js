// Port Serena itself: the road grid, the buildings that fill its blocks, the palms, the
// marina and the collision answers every other system asks. The city is generated once from
// a seed: the same seed always raises the same streets, so traffic routes, mission markers
// and staged screenshots all agree about where things stand.

import { PALETTE, ROADS_X, ROADS_Y, ROAD_HALF, WORLD } from './config.js';
import { createRandom, pickFrom, rangeFrom } from './random.js';

const ROOF_COLORS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];
const BUILDING_NAMES = [
  'Cafe Solano', 'Hotel Brisa', 'Serena Bank', 'Palm Arcade', 'Marina Market',
  'Club Nautica', 'Radio Serena', 'Port Authority', 'Solano Motors', 'Bea’s Bakery',
  'Harbor Clinic', 'Vista Apartments', 'Pier Nine Store', 'Old Town Library',
  'Sunset Gym', 'Coral Hotel', 'Dockside Diner', 'Palma Mall', 'Serena Records',
  'Lighthouse Books',
];

/** True when the point stands on a road (either direction), the beach road included. */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  if (y >= WORLD.beachY - 40 && y <= WORLD.waterY) return true;
  return false;
}

/** The nearest road centreline point, used to drop traffic and police into the network. */
export function nearestRoadPoint(x, y) {
  let best = { x, y, distance: Infinity };
  for (const rx of ROADS_X) {
    const distance = Math.abs(x - rx);
    if (distance < best.distance) best = { x: rx, y, distance };
  }
  for (const ry of ROADS_Y) {
    const distance = Math.abs(y - ry);
    if (distance < best.distance) best = { x, y: ry, distance };
  }
  return best;
}

/** Push a circle out of every building it overlaps; returns the corrected centre. */
export function resolveCircleCollisions(buildings, x, y, radius) {
  let cx = x;
  let cy = y;
  for (const b of buildings) {
    const nearX = Math.max(b.x, Math.min(cx, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(cy, b.y + b.h));
    const dx = cx - nearX;
    const dy = cy - nearY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq >= radius * radius) continue;
    if (distanceSq > 0.0001) {
      const distance = Math.sqrt(distanceSq);
      cx = nearX + (dx / distance) * radius;
      cy = nearY + (dy / distance) * radius;
    } else {
      // The centre is inside the building: leave by the shallowest side.
      const left = cx - b.x;
      const right = b.x + b.w - cx;
      const top = cy - b.y;
      const bottom = b.y + b.h - cy;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) cx = b.x - radius;
      else if (shallowest === right) cx = b.x + b.w + radius;
      else if (shallowest === top) cy = b.y - radius;
      else cy = b.y + b.h + radius;
    }
  }
  return { x: cx, y: cy };
}

export function circleHitsBuilding(buildings, x, y, radius) {
  for (const b of buildings) {
    const nearX = Math.max(b.x, Math.min(x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nearX;
    const dy = y - nearY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/**
 * Build the whole city: building rectangles with names and roof colours, palm positions,
 * the marina piers and the named places missions point at. Pure data — the renderer draws
 * it and the simulation collides with it.
 */
export function createCity(seed) {
  const random = createRandom(seed ^ 0x51ab);
  const buildings = [];
  const palms = [];
  let nameIndex = 0;

  const edgesX = [80, ...ROADS_X.flatMap((rx) => [rx - ROAD_HALF - 26, rx + ROAD_HALF + 26]), WORLD.width - 80];
  const edgesY = [80, ...ROADS_Y.flatMap((ry) => [ry - ROAD_HALF - 26, ry + ROAD_HALF + 26]), WORLD.beachY - 30];

  for (let ix = 0; ix + 1 < edgesX.length; ix += 2) {
    for (let iy = 0; iy + 1 < edgesY.length; iy += 2) {
      const blockX = edgesX[ix];
      const blockY = edgesY[iy];
      const blockW = edgesX[ix + 1] - blockX;
      const blockH = edgesY[iy + 1] - blockY;
      if (blockW < 200 || blockH < 200) continue;
      const split = random() > 0.45;
      const cells = split
        ? [
            { x: blockX, y: blockY, w: blockW / 2 - 14, h: blockH / 2 - 14 },
            { x: blockX + blockW / 2 + 14, y: blockY, w: blockW / 2 - 14, h: blockH / 2 - 14 },
            { x: blockX, y: blockY + blockH / 2 + 14, w: blockW / 2 - 14, h: blockH / 2 - 14 },
            { x: blockX + blockW / 2 + 14, y: blockY + blockH / 2 + 14, w: blockW / 2 - 14, h: blockH / 2 - 14 },
          ]
        : [{ x: blockX + 16, y: blockY + 16, w: blockW - 32, h: blockH - 32 }];
      for (const cell of cells) {
        if (random() < 0.12) continue; // an empty lot or plaza keeps the city breathing
        buildings.push({
          x: cell.x + rangeFrom(random, 0, 18),
          y: cell.y + rangeFrom(random, 0, 18),
          w: cell.w - rangeFrom(random, 0, 30),
          h: cell.h - rangeFrom(random, 0, 30),
          color: pickFrom(random, ROOF_COLORS),
          name: BUILDING_NAMES[nameIndex % BUILDING_NAMES.length],
          floors: 2 + Math.floor(random() * 6),
        });
        nameIndex += 1;
      }
      // Palms at the block corners, clear of the road.
      palms.push({ x: blockX - 12, y: blockY - 12 });
      palms.push({ x: blockX + blockW + 12, y: blockY + blockH + 12 });
    }
  }

  // A double row of palms along the boardwalk.
  for (let x = 180; x < WORLD.width - 120; x += 170) {
    palms.push({ x, y: WORLD.beachY + 26 });
    palms.push({ x: x + 60, y: WORLD.waterY - 30 });
  }

  const piers = [];
  for (const px of [2250, 2620, 2990]) piers.push({ x: px, y: WORLD.waterY, w: 54, h: 190 });

  const places = {
    start: { x: 1500, y: 1020, label: 'Rio’s Apartment, Palm Row' },
    marina: { x: 2400, y: 2280, label: 'Serena Marina' },
    cafe: { x: 940, y: 980, label: 'Cafe Solano' },
    chopShop: { x: 3260, y: 980, label: 'Solano Motors (back lot)' },
    boardwalkWest: { x: 700, y: 2300, label: 'Boardwalk West' },
    boardwalkMid: { x: 1500, y: 2300, label: 'Boardwalk Kiosks' },
    boardwalkEast: { x: 2300, y: 2300, label: 'Boardwalk East' },
    safehouse: { x: 360, y: 420, label: 'Auntie Bea’s Safehouse, Old Town' },
    docks: { x: 3300, y: 2280, label: 'Port Docks' },
    warehouse: { x: 980, y: 420, label: 'Harbor Warehouse' },
    pier: { x: 2620, y: 2600, label: 'Pier Nine, Marina' },
    hospital: { x: 2140, y: 980, label: 'Harbor Clinic' },
    hotel: { x: 2740, y: 980, label: 'Hotel Brisa' },
    marinaLot: { x: 2460, y: 2160, label: 'Marina Parking Lot' },
  };

  return { buildings, palms, piers, places, seed };
}
