// config.js — every tuning number for Vice Harbor lives here, grouped by the
// system that owns it. Nothing in this file reaches for the DOM or the clock;
// it is pure data the rest of the game reads.

export const WORLD = {
  width: 3200,
  height: 2400,
  beachY: 2140,          // sand starts here
  waterY: 2280,          // open water starts here
  pier: { x: 1180, y: 2190, w: 130, h: 210 },
};

export const SAVE_KEY = 'vice-harbor-save-v3';
export const STEP = 1 / 60;

// Avenues run north-south, streets run east-west. Buildings fill the blocks
// between them, so anything on these lines is guaranteed open ground.
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS = [200, 600, 1000, 1400, 1800, 2200];

// Wanted heat: stars are thresholds over a single heat score. Heat 170 is
// exactly four stars — Searchlight Run leans on that.
export const HEAT_LEVELS = [0, 30, 70, 120, 170, 260];
export const HEAT_LOCK_RUN = 170;

export const PLAYER = {
  radius: 13,
  walkSpeed: 152,
  sprintSpeed: 218,
  startX: 262,
  startY: 368,
  startCash: 120,
};

export const SAFEHOUSE = { x: 200, y: 340, name: 'Old Town Safehouse' };
export const CLINIC = { x: 1250, y: 430, name: "Bea's Corner Clinic" };

// Six drivable shells. top is px/s, grip shapes how fast the nose swings.
export const VEHICLE_TYPES = [
  { id: 'coupe', name: 'Calle Coupe', top: 252, accel: 205, grip: 2.6, hp: 120, color: '#e2543e' },
  { id: 'gt', name: 'Solano GT', top: 308, accel: 262, grip: 2.9, hp: 110, color: '#f2b035' },
  { id: 'sedan', name: 'Palma Sedan', top: 224, accel: 172, grip: 2.3, hp: 140, color: '#7fb2d9' },
  { id: 'taxi', name: 'Harbor Taxi', top: 232, accel: 180, grip: 2.3, hp: 140, color: '#ffd23e' },
  { id: 'truck', name: 'Dockmaster Truck', top: 196, accel: 138, grip: 1.8, hp: 220, color: '#8a9a5b' },
  { id: 'cruiser', name: 'Serena Cruiser', top: 282, accel: 238, grip: 2.7, hp: 180, color: '#e8ecf2' },
];

// Weapon table. slot is the number key that draws it; mag is rounds per
// reload; rof is seconds between shots (0 = press-per-shot semi handling in
// the weapons module, using `semi`).
export const WEAPON_DEFS = {
  fists:   { slot: 5, label: 'Fists', damage: 12, range: 36, rof: 0.34, semi: true },
  pistol:  { slot: 1, label: 'Harbor Pistol', damage: 22, range: 520, rof: 0.26, semi: true, mag: 12, speed: 640 },
  smg:     { slot: 2, label: 'Calle SMG', damage: 13, range: 460, rof: 0.072, semi: false, mag: 30, speed: 620 },
  shotgun: { slot: 3, label: 'Dockside Shotgun', damage: 15, range: 300, rof: 0.8, semi: true, mag: 6, speed: 560, pellets: 6, spread: 0.16 },
  grenade: { slot: 4, label: 'Grenade', damage: 70, range: 240, rof: 0.6, semi: true, mag: 1, fuse: 0.75, blast: 96 },
};

// Serena Munitions shelf, in the order the number keys buy them.
export const GUN_SHOP = { x: 600, y: 1000, name: 'Serena Munitions', items: [
  { label: 'Harbor Pistol', price: 180, act: 'own-pistol' },
  { label: 'Calle SMG', price: 420, act: 'own-smg' },
  { label: 'Dockside Shotgun', price: 380, act: 'own-shotgun' },
  { label: 'Grenades x3', price: 90, act: 'grenades' },
  { label: 'Pistol rounds +36', price: 40, act: 'ammo-pistol' },
  { label: 'SMG rounds +60', price: 60, act: 'ammo-smg' },
  { label: 'Shells +12', price: 50, act: 'ammo-shotgun' },
  { label: 'Kevlar vest', price: 150, act: 'armor' },
] };

// Serena Customs counter, same idea for anything with wheels.
export const GARAGE = { x: 2200, y: 1400, name: 'Serena Customs', items: [
  { label: 'Engine tune', price: 300, act: 'mod-engine' },
  { label: 'Armour plating', price: 350, act: 'mod-plating' },
  { label: 'Nitro kit', price: 250, act: 'mod-nitro' },
  { label: 'Respray', price: 120, act: 'respray' },
  { label: 'Full repair', price: 100, act: 'repair' },
] };

// Four stunt ramps. The Palm Row ramp sits just east of x=1120 on the y=600
// street and throws cars that cross it with speed.
export const RAMPS = [
  { x: 1212, y: 600, w: 54, h: 44 },
  { x: 2280, y: 1000, w: 54, h: 44 },
  { x: 1018, y: 1800, w: 54, h: 44 },
  { x: 2680, y: 2200, w: 54, h: 44 },
];

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1050, h: 850, roof: ['#b08968', '#9c6644', '#7f5539'], wall: '#d9c7a7' },
  { name: 'University Quarter', x: 1050, y: 0, w: 1100, h: 850, roof: ['#6a8eae', '#55748f', '#476278'], wall: '#cfd8dc' },
  { name: 'Serena Marina', x: 2150, y: 0, w: 1050, h: 850, roof: ['#4ecdc4', '#38ada5', '#2d8f89'], wall: '#e8f6f3' },
  { name: 'Palm Row', x: 0, y: 850, w: 1700, h: 420, roof: ['#ef6f6c', '#e2543e', '#c7432f'], wall: '#ffe8d6' },
  { name: 'Downtown', x: 1700, y: 850, w: 1500, h: 420, roof: ['#5d6d7e', '#47525f', '#37424e'], wall: '#b8c4ce' },
  { name: 'The Boardwalk', x: 0, y: 2050, w: 3200, h: 350, roof: ['#f4a259', '#e07a3f', '#bc4b26'], wall: '#ffedd8' },
  { name: 'Port Docks', x: 2150, y: 1270, w: 1050, h: 780, roof: ['#7d8597', '#646e82', '#4a5265'], wall: '#c9ced6' },
  { name: 'Midtown', x: 0, y: 1270, w: 2150, h: 780, roof: ['#84a98c', '#6a8f71', '#52755a'], wall: '#e3ecd9' },
];

export const DAY_LENGTH = 240; // seconds for a full 24h cycle
export const START_HOUR = 9.25;
