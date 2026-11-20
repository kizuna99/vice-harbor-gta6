// Vice Harbor — Port Serena : central tuning table (v2)
// Every balance number for the city lives here so the rest of the code
// can stay focused on behaviour instead of magic constants. The v2 pass
// adds the arsenal, the two shops, the stunt ramps and the roadblock
// tuning alongside the original v1 numbers.

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
  // v2: cruiser roadblocks appear at four stars and up.
  roadblockFromStar: 4,
  roadblockCars: 2,
  roadblockRespawnSec: 7,
  roadblockAheadPx: 360,
};

export const CRIME_HEAT = {
  punch: 12,
  stealCar: 35,
  hitPed: 45,
  hitCar: 10,
  recklessSpeed: 2, // per second over threshold near a cop
  gunshot: 4,       // per shot, only when a unit is close enough to hear
  blast: 26,        // grenade / cook-off, same witness rule
  shootCop: 30,
  downCop: 55,
};

// Eight jobs now: Bea's original six plus the two v2 heavy jobs.
export const MISSION_REWARDS = {
  cash:   [220, 380, 450, 520, 400, 700, 850, 1000],
  respect:[6, 10, 12, 14, 10, 20, 24, 30],
};

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 235,
  radius: 11,
  maxHealth: 100,
  maxArmor: 100,
  armorSoak: 0.65,       // share of incoming damage the vest eats first
  punchRange: 30,
  punchCooldown: 0.32,
  punchDamage: 34,
};

// The two shops. Serena Munitions is used on foot; Serena Customs
// needs Rio sitting in the car he wants worked on.
export const SHOPS = [
  { id: 'weapons', name: 'Serena Munitions', short: 'W', x: 600,  y: 1000, needCar: false, radius: 80 },
  { id: 'garage',  name: 'Serena Customs',   short: 'G', x: 2200, y: 1400, needCar: true,  radius: 88 },
];

export const WEAPON_SHOP_ITEMS = [
  { key: 'Digit1', kind: 'weapon',  id: 'pistol',  label: 'Harbor Pistol',      price: 180 },
  { key: 'Digit2', kind: 'weapon',  id: 'smg',     label: 'Calle SMG',          price: 420 },
  { key: 'Digit3', kind: 'weapon',  id: 'shotgun', label: 'Dockside Shotgun',   price: 650 },
  { key: 'Digit4', kind: 'grenade', id: 'grenade', label: 'Grenades ×3',        price: 90 },
  { key: 'Digit5', kind: 'ammo',    id: 'pistol',  label: 'Pistol rounds +36',  price: 40 },
  { key: 'Digit6', kind: 'ammo',    id: 'smg',     label: 'SMG rounds +90',     price: 60 },
  { key: 'Digit7', kind: 'ammo',    id: 'shotgun', label: 'Shells +18',         price: 50 },
  { key: 'Digit8', kind: 'kevlar',  id: 'armor',   label: 'Kevlar vest (full)', price: 150 },
];

export const GARAGE_ITEMS = [
  { key: 'Digit1', kind: 'mod', id: 'engine',  label: 'Engine tune (+13%)', price: 300 },
  { key: 'Digit2', kind: 'mod', id: 'plating', label: 'Armor plating',      price: 350 },
  { key: 'Digit3', kind: 'respray', id: 'respray', label: 'Respray + repair', price: 120 },
];

export const STUNT = {
  minSpeed: 110,         // px/s needed at the ramp lip to leave the ground
  gravity: 620,          // px/s^2 pulling airZ back down
  bonusPeak: 40,         // airZ peak that earns the style bonus
  bonusCash: 15,
};

export const SAVE_KEY = 'vice-harbor-save-v3';

export const DAY_LENGTH_SEC = 240; // one full day-night cycle
export const START_HOUR = 16.4;     // late afternoon golden light
