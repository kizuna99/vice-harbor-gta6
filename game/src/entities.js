// The living street: traffic that follows the road grid, parked cars waiting to be taken,
// and pedestrians who stroll the sidewalks, flee danger and fall when hurt. Every actor is
// plain data the simulation steps and the renderer draws; none of them know about the DOM.

import { COUNTS, LANE_OFFSET, ROADS_X, ROADS_Y, VEHICLE_MODELS, WORLD } from './config.js';
import { createRandom, pickFrom, rangeFrom } from './random.js';

function makeVehicle(random, model, x, y, angle, driver) {
  return {
    x, y, angle, speed: 0,
    model, color: model.color, kind: model.kind,
    driver, health: 100, honkTimer: 0,
    axis: 'x', direction: 1, cruise: rangeFrom(random, 120, 210),
  };
}

/** Place a vehicle on a random road, driving along it in the right-hand lane. */
function placeOnRoad(vehicle, random) {
  if (random() < 0.5) {
    vehicle.axis = 'x';
    vehicle.direction = random() < 0.5 ? 1 : -1;
    vehicle.y = pickFrom(random, ROADS_Y) + (vehicle.direction > 0 ? LANE_OFFSET : -LANE_OFFSET);
    vehicle.x = rangeFrom(random, 120, WORLD.width - 120);
    vehicle.angle = vehicle.direction > 0 ? 0 : Math.PI;
  } else {
    vehicle.axis = 'y';
    vehicle.direction = random() < 0.5 ? 1 : -1;
    vehicle.x = pickFrom(random, ROADS_X) + (vehicle.direction > 0 ? -LANE_OFFSET : LANE_OFFSET);
    vehicle.y = rangeFrom(random, 120, WORLD.beachY - 80);
    vehicle.angle = vehicle.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

export function createTraffic(random) {
  const vehicles = [];
  for (let i = 0; i < COUNTS.traffic; i += 1) {
    const vehicle = makeVehicle(random, pickFrom(random, VEHICLE_MODELS), 0, 0, 0, 'traffic');
    placeOnRoad(vehicle, random);
    vehicle.speed = vehicle.cruise;
    vehicles.push(vehicle);
  }
  return vehicles;
}

export function createParkedCars(random) {
  const cars = [];
  for (let i = 0; i < COUNTS.parked; i += 1) {
    const model = pickFrom(random, VEHICLE_MODELS);
    const onX = random() < 0.5;
    const car = makeVehicle(random, model, 0, 0, 0, 'parked');
    if (onX) {
      car.x = rangeFrom(random, 160, WORLD.width - 160);
      const roadY = pickFrom(random, ROADS_Y);
      car.y = roadY + (random() < 0.5 ? 46 : -46);
      car.angle = random() < 0.5 ? 0 : Math.PI;
    } else {
      const roadX = pickFrom(random, ROADS_X);
      car.x = roadX + (random() < 0.5 ? 46 : -46);
      car.y = rangeFrom(random, 160, WORLD.beachY - 120);
      car.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    cars.push(car);
  }
  return cars;
}

function nearestIntersection(vehicle) {
  const lines = vehicle.axis === 'x' ? ROADS_X : ROADS_Y;
  const along = vehicle.axis === 'x' ? vehicle.x : vehicle.y;
  let best = null;
  for (const line of lines) {
    const delta = (line - along) * vehicle.direction;
    if (delta > 4 && (best === null || delta < best.delta)) best = { line, delta };
  }
  return best;
}

/**
 * Step one traffic vehicle: hold the lane, slow for the vehicle ahead, and sometimes turn
 * at the next intersection onto the crossing road, exactly as a city driver would.
 */
export function stepTrafficVehicle(vehicle, allVehicles, random, dt) {
  let targetSpeed = vehicle.cruise;
  for (const other of allVehicles) {
    if (other === vehicle) continue;
    const dx = other.x - vehicle.x;
    const dy = other.y - vehicle.y;
    const ahead = vehicle.axis === 'x' ? dx * vehicle.direction : dy * vehicle.direction;
    const lateral = vehicle.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
    if (ahead > 0 && ahead < 74 && lateral < 24) targetSpeed = Math.min(targetSpeed, other.speed * 0.85);
  }
  vehicle.speed += Math.max(-260 * dt, Math.min(160 * dt, targetSpeed - vehicle.speed));

  const crossing = nearestIntersection(vehicle);
  if (crossing && crossing.delta < 6 && random() < 0.34) {
    // Turn: swap the axis, keep the world position on the crossing road's centre.
    if (vehicle.axis === 'x') {
      vehicle.x = crossing.line;
      vehicle.axis = 'y';
      vehicle.direction = random() < 0.5 ? 1 : -1;
      vehicle.x += vehicle.direction > 0 ? -LANE_OFFSET : LANE_OFFSET;
      vehicle.angle = vehicle.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      vehicle.y = crossing.line;
      vehicle.axis = 'x';
      vehicle.direction = random() < 0.5 ? 1 : -1;
      vehicle.y += vehicle.direction > 0 ? LANE_OFFSET : -LANE_OFFSET;
      vehicle.angle = vehicle.direction > 0 ? 0 : Math.PI;
    }
    return;
  }

  if (vehicle.axis === 'x') vehicle.x += vehicle.direction * vehicle.speed * dt;
  else vehicle.y += vehicle.direction * vehicle.speed * dt;

  // Wrap at the city edge instead of leaving the world.
  if (vehicle.x < 60) vehicle.x = WORLD.width - 70;
  if (vehicle.x > WORLD.width - 60) vehicle.x = 70;
  if (vehicle.y < 60) vehicle.y = WORLD.beachY - 90;
  if (vehicle.y > WORLD.beachY - 70) vehicle.y = 70;
}

const PED_COLORS = ['#e2703a', '#3f8f8a', '#d95f76', '#7a6fb0', '#e0a83c', '#4c8f52', '#e8e4d2'];

export function createPedestrians(random) {
  const pedestrians = [];
  for (let i = 0; i < COUNTS.pedestrians; i += 1) {
    const onX = random() < 0.5;
    const ped = {
      x: 0, y: 0, angle: 0, speed: rangeFrom(random, 42, 78),
      color: pickFrom(random, PED_COLORS),
      state: 'walk', stateTimer: 0, targetX: 0, targetY: 0, fallTimer: 0,
    };
    if (onX) {
      ped.x = rangeFrom(random, 140, WORLD.width - 140);
      ped.y = pickFrom(random, ROADS_Y) + (random() < 0.5 ? 84 : -84);
    } else {
      ped.x = pickFrom(random, ROADS_X) + (random() < 0.5 ? 84 : -84);
      ped.y = rangeFrom(random, 140, WORLD.beachY - 100);
    }
    choosePedestrianTarget(ped, random);
    pedestrians.push(ped);
  }
  return pedestrians;
}

export function choosePedestrianTarget(ped, random) {
  // Stroll along the sidewalk lines: a new target on a nearby street edge.
  if (random() < 0.5) {
    ped.targetX = Math.max(90, Math.min(WORLD.width - 90, ped.x + rangeFrom(random, -560, 560)));
    ped.targetY = ped.y + rangeFrom(random, -26, 26);
  } else {
    ped.targetX = ped.x + rangeFrom(random, -26, 26);
    ped.targetY = Math.max(90, Math.min(WORLD.beachY - 60, ped.y + rangeFrom(random, -560, 560)));
  }
}

export function stepPedestrian(ped, random, dt, danger) {
  if (ped.state === 'down') {
    ped.fallTimer -= dt;
    if (ped.fallTimer <= 0) ped.state = 'walk';
    return;
  }
  if (danger) {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 190) ped.state = 'flee';
    else if (ped.state === 'flee') ped.state = 'walk';
    if (ped.state === 'flee' && distance > 0.01) {
      ped.x += (dx / distance) * 172 * dt;
      ped.y += (dy / distance) * 172 * dt;
      ped.angle = Math.atan2(dy, dx);
      ped.x = Math.max(40, Math.min(WORLD.width - 40, ped.x));
      ped.y = Math.max(40, Math.min(WORLD.waterY - 30, ped.y));
      return;
    }
  }
  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 12) {
    choosePedestrianTarget(ped, random);
    return;
  }
  ped.x += (dx / distance) * ped.speed * dt;
  ped.y += (dy / distance) * ped.speed * dt;
  ped.angle = Math.atan2(dy, dx);
}

/** Knock a pedestrian down (a punch or a bumper): they stay down, then get up and walk on. */
export function knockDownPedestrian(ped) {
  ped.state = 'down';
  ped.fallTimer = 2.6;
}
