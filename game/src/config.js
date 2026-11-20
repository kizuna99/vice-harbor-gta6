// Port Serena tuning table — rebuilt for the v2 recorded edition.
// All balance numbers live in this one module: world geometry, the
// vehicle roster, wanted thresholds, shop coordinates and rewards.

export const WORLD = {
  width: 3200,
  height: 2400,
  roadGap: 400,
  roadWidth: 92,
  blockSize: 308,
};

export const DISTRICTS = [
  { id: 'oldtown', name: 'Old Town', x: 0, y: 0, w: 1100, h: 900, tint: '#3a2f28' },
  { id: 'palmrow', name: 'Palm Row', x: 1100, y: 0, w: 1000, h: 900, tint: '#2e3b2a' },
  { id: 'university', name: 'University Quarter', x: 2100, y: 0, w: 1100, h: 900, tint: '#2b3040' },
  { id: 'marina', name: 'Serena Marina', x: 0, y: 900, w: 1100, h: 750, tint: '#24343e' },
  { id: 'boardwalk', name: 'Boardwalk', x: 1100, y: 900, w: 1000, h: 750, tint: '#3d3424' },
  { id: 'docks', name: 'Port Docks', x: 2100, y: 900, w: 1100, h: 750, tint: '#33302a' },
];

// Drivable models: topSpeed px/s, accel px/s^2, grip is flavour for AI.
export const VEHICLES = [
  { id: 'calle', name: 'Calle Coupe', w: 34, h: 62, topSpeed: 300, accel: 260, grip: 0.92, colors: ['#c94f6d', '#e07a3f', '#4f7dc9', '#f2d24b'] },
  { id: 'solano', name: 'Solano GT', w: 36, h: 66, topSpeed: 380, accel: 340, grip: 0.94, colors: ['#d92632', '#111418', '#f5f5f0', '#ffb400'] },
  { id: 'palma', name: 'Palma Sedan', w: 36, h: 64, topSpeed: 260, accel: 210, grip: 0.90, colors: ['#8fa3b8', '#5b6b7a', '#d9d9d9', '#2f4f4f'] },
  { id: 'taxi', name: 'Harbor Taxi', w: 36, h: 64, topSpeed: 270, accel: 225, grip: 0.90, colors: ['#f7c948'] },
  { id: 'truck', name: 'Dockmaster Truck', w: 44, h: 88, topSpeed: 215, accel: 170, grip: 0.86, colors: ['#7a8b6f', '#a65e2e', '#546e7a'] },
  { id: 'cruiser', name: 'Serena Cruiser', w: 38, h: 66, topSpeed: 330, accel: 300, grip: 0.93, colors: ['#f2f2f2'], police: true },
];

export const WANTED = {
  // Heat needed per star. 170 heat is exactly four stars, which the
  // Searchlight Run finale locks Rio at.
  thresholds: [0, 30, 70, 120, 170, 260],
  decayPerSec: 4,
  unseenGraceSec: 2.5,
  policeCarsByStar: [0, 1, 2, 3, 4, 6],
  footCopsByStar: [0, 0, 1, 2, 3, 4],
  heliFromStar: 3,
  arrestRadius: 46,
  arrestFillPerSec: 0.55,
  arrestDrainPerSec: 0.8,
  roadblockFromStar: 4,
  roadblockCooldownSec: 7,
};

export const CRIME_HEAT = {
  punch: 12,
  stealCar: 35,
  hitPed: 45,
  hitCar: 10,
  recklessSpeed: 2,
  gunshot: 9,
};

// Eight jobs now: the original six plus Dockside Crossfire and the
// Searchlight Run. Rewards stay parallel to the JOBS array.
export const MISSION_REWARDS = {
  cash: [220, 380, 450, 520, 400, 700, 650, 800],
  respect: [6, 10, 12, 14, 10, 20, 16, 22],
};

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 235,
  radius: 11,
  maxHealth: 100,
  maxArmor: 100,
  punchRange: 30,
  punchCooldown: 0.32,
  punchDamage: 34,
  armorAbsorb: 0.65,
};

// Fixed world anchors the harness and the story both rely on.
export const WEAPON_SHOP = { x: 600, y: 1000, name: 'Serena Munitions', radius: 68 };
export const GARAGE = { x: 2200, y: 1400, name: 'Serena Customs', radius: 88 };
export const SAFEHOUSE = { x: 200, y: 340, name: 'Old Town Safehouse', radius: 74 };

export const SAVE_KEY = 'vice-harbor-save-v3';
export const DAY_LENGTH_SEC = 240;
export const START_HOUR = 16.4;
