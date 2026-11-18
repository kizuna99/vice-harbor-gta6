// Vice Harbor — Port Serena : central tuning table
// Every balance number for the city lives here so the rest of the code
// can stay focused on behaviour instead of magic constants.

export const WORLD = {
  width: 3200,
  height: 2400,
  roadGap: 400,          // distance between avenues
  roadWidth: 92,
  blockSize: 308,        // roadGap - roadWidth
};

export const DISTRICTS = [
  { id: 'oldtown',   name: 'Old Town',          x: 0,    y: 0,    w: 1100, h: 900,  tint: '#3a2f28' },
  { id: 'palmrow',   name: 'Palm Row',          x: 1100, y: 0,    w: 1000, h: 900,  tint: '#2e3b2a' },
  { id: 'university',name: 'University Quarter',x: 2100, y: 0,    w: 1100, h: 900,  tint: '#2b3040' },
  { id: 'marina',    name: 'Serena Marina',     x: 0,    y: 900,  w: 1100, h: 750,  tint: '#24343e' },
  { id: 'boardwalk', name: 'Boardwalk',         x: 1100, y: 900,  w: 1000, h: 750,  tint: '#3d3424' },
  { id: 'docks',     name: 'Port Docks',        x: 2100, y: 900,  w: 1100, h: 750,  tint: '#33302a' },
];

// Six drivable models. topSpeed in px/s, accel in px/s^2.
export const VEHICLES = [
  { id: 'calle',    name: 'Calle Coupe',      w: 34, h: 62, topSpeed: 300, accel: 260, grip: 0.92, colors: ['#c94f6d', '#e07a3f', '#4f7dc9', '#f2d24b'] },
  { id: 'solano',   name: 'Solano GT',        w: 36, h: 66, topSpeed: 380, accel: 340, grip: 0.94, colors: ['#d92632', '#111418', '#f5f5f0', '#ffb400'] },
  { id: 'palma',    name: 'Palma Sedan',      w: 36, h: 64, topSpeed: 260, accel: 210, grip: 0.90, colors: ['#8fa3b8', '#5b6b7a', '#d9d9d9', '#2f4f4f'] },
  { id: 'taxi',     name: 'Harbor Taxi',      w: 36, h: 64, topSpeed: 270, accel: 225, grip: 0.90, colors: ['#f7c948'] },
  { id: 'truck',    name: 'Dockmaster Truck', w: 44, h: 88, topSpeed: 215, accel: 170, grip: 0.86, colors: ['#7a8b6f', '#a65e2e', '#546e7a'] },
  { id: 'cruiser',  name: 'Serena Cruiser',   w: 38, h: 66, topSpeed: 330, accel: 300, grip: 0.93, colors: ['#f2f2f2'], police: true },
];

export const WANTED = {
  // heat points needed to reach each star level (index = stars)
  thresholds: [0, 30, 80, 150, 240, 360],
  decayPerSec: 4,        // only while unseen
  unseenGraceSec: 2.5,
  policeCarsByStar: [0, 1, 2, 3, 4, 6],
  footCopsByStar:   [0, 0, 1, 2, 3, 4],
  heliFromStar: 3,
  arrestRadius: 46,
  arrestFillPerSec: 0.55,
  arrestDrainPerSec: 0.8,
};

export const CRIME_HEAT = {
  punch: 12,
  stealCar: 35,
  hitPed: 45,
  hitCar: 10,
  recklessSpeed: 2, // per second over threshold near a cop
};

export const MISSION_REWARDS = {
  cash:   [220, 380, 450, 520, 400, 700],
  respect:[6, 10, 12, 14, 10, 20],
};

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 235,
  radius: 11,
  maxHealth: 100,
  punchRange: 30,
  punchCooldown: 0.32,
  punchDamage: 34,
};

export const SAVE_KEY = 'vice-harbor-save-v3';

export const DAY_LENGTH_SEC = 240; // one full day-night cycle
export const START_HOUR = 16.4;     // late afternoon golden light
