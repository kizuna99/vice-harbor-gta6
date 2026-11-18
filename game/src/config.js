// config.js — Vice Harbor: Port Serena — central tuning constants.
// Every number that shapes balance lives here so the other modules stay
// focused on behaviour instead of magic values.

export const CFG = {
  worldW: 3200,
  worldH: 2400,
  roadW: 84,
  laneOffset: 21,
  tile: 40,

  playerWalkSpeed: 168,
  playerSprintSpeed: 262,
  playerRadius: 11,
  playerHealth: 100,

  trafficCount: 26,
  parkedCount: 30,
  pedCount: 34,

  dayLengthSec: 240, // one full Port Serena day
  startHour: 16.2,   // golden afternoon when a fresh game boots

  wantedDecayPerSec: 4.5,
  arrestRange: 46,
  arrestFillPerSec: 0.55,
  arrestDrainPerSec: 0.8,

  clinicFeeRate: 0.10, // Harbor Clinic takes 10% of carried cash

  particleCap: 240,
  skidCap: 300,
};

// Six original vehicle models. `top` is px/s, `accel` px/s^2, `grip` is a
// 0..1 steering feel factor, `seats` matters for the VIP job.
export const VEHICLE_MODELS = [
  { id: 'calle',    name: 'Calle Coupe',      top: 330, accel: 210, grip: 0.92, w: 44, h: 22, color: '#e4572e', seats: 2 },
  { id: 'solano',   name: 'Solano GT',        top: 430, accel: 300, grip: 0.97, w: 46, h: 22, color: '#ffd23f', seats: 2 },
  { id: 'palma',    name: 'Palma Sedan',      top: 290, accel: 175, grip: 0.88, w: 46, h: 23, color: '#4ea8de', seats: 4 },
  { id: 'taxi',     name: 'Harbor Taxi',      top: 285, accel: 180, grip: 0.88, w: 46, h: 23, color: '#f4b41a', seats: 4 },
  { id: 'dock',     name: 'Dockmaster Truck', top: 235, accel: 130, grip: 0.80, w: 58, h: 26, color: '#8d99ae', seats: 2 },
  { id: 'cruiser',  name: 'Serena Cruiser',   top: 360, accel: 240, grip: 0.93, w: 47, h: 23, color: '#edf2f4', seats: 4, police: true },
];

export function modelById(id) {
  return VEHICLE_MODELS.find((m) => m.id === id) || VEHICLE_MODELS[2];
}

// Wanted thresholds: index = star count. `cars`/`foot` = how many SPD units
// the simulation tries to keep in play, `speed` multiplies pursuit pace.
export const WANTED_LEVELS = [
  { stars: 0, cars: 0, foot: 0, speed: 0.00, label: 'Clean' },
  { stars: 1, cars: 1, foot: 1, speed: 0.86, label: 'Noticed' },
  { stars: 2, cars: 2, foot: 2, speed: 0.94, label: 'Pursued' },
  { stars: 3, cars: 3, foot: 3, speed: 1.00, label: 'Hunted' },
  { stars: 4, cars: 5, foot: 4, speed: 1.07, label: 'Cornered' },
  { stars: 5, cars: 7, foot: 5, speed: 1.14, label: 'Citywide Manhunt' },
];

// Heat points handed out per crime. Heat converts to stars in police.js.
export const HEAT = {
  stealCar: 22,
  stealMovingCar: 34,
  punchPed: 16,
  punchOfficer: 30,
  hitPedWithCar: 40,
  hitPoliceCar: 26,
  propertyHit: 6,
};

// Cash / respect paid by each of the six story jobs, in order.
export const MISSION_REWARDS = [
  { cash: 150, respect: 5 },
  { cash: 300, respect: 10 },
  { cash: 450, respect: 14 },
  { cash: 600, respect: 18 },
  { cash: 750, respect: 22 },
  { cash: 1200, respect: 35 },
];

export const SAVE_KEY = 'vice-harbor-port-serena-v2';
