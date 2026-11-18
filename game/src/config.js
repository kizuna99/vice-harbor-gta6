// Vice Harbor tuning: every number that shapes Port Serena lives here, so the simulation,
// the renderer and the screenshot staging all read the same world. The view is a fixed
// 1280x720 logical stage that the renderer scales to the window; the world itself is a
// 3600x2700 coastal city the camera travels across.
// Recorded-session build: this module is written first because everything else imports it —
// freezing the tuning in one place is what keeps the traffic, police and mission numbers
// consistent between a live play session and a staged screenshot.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2700, beachY: 2380, waterY: 2540 };

/** Road centrelines: traffic drives on these, pedestrians walk the block edges beside them. */
export const ROADS_X = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_Y = [300, 900, 1500, 2100];
export const ROAD_HALF = 62;
export const LANE_OFFSET = 30;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 262,
  health: 100,
  punchRange: 36,
  punchDamage: 34,
  enterRange: 60,
};

export const VEHICLE = {
  radius: 27,
  truckRadius: 34,
  accel: 340,
  brake: 520,
  reverseMax: 120,
  drag: 0.62,
  gripTurn: 2.55,
};

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  helicopterStar: 3,
  arrestSeconds: 1.6,
};

export const COUNTS = { traffic: 15, parked: 21, pedestrians: 26 };

export const SAVE_KEY = 'vice-harbor.save.v1';

export const PALETTE = {
  grass: '#57a05e',
  grassDark: '#4c8f52',
  sand: '#ecd28a',
  water: '#2e7fa8',
  waterDeep: '#256b91',
  road: '#3c4148',
  roadEdge: '#f4e3b2',
  laneMark: '#e8e4d2',
  sidewalk: '#b9b3a4',
  plaza: '#cfc7ae',
  roofA: '#e2703a',
  roofB: '#d95f76',
  roofC: '#3f8f8a',
  roofD: '#7a6fb0',
  roofE: '#e0a83c',
  wallShade: 'rgba(60,30,10,0.25)',
  palmTrunk: '#8a6a42',
  palmLeaf: '#2f8f4e',
  player: '#ffd23c',
  police: '#274690',
  policeLightA: '#ff4747',
  policeLightB: '#3c7bff',
  marker: '#37e08b',
  markerJob: '#ffb52e',
  danger: '#ff5a4e',
  hudPanel: 'rgba(10,18,28,0.72)',
  hudText: '#f4f1e6',
  hudMuted: '#b9c4c9',
  starOn: '#ffd23c',
  starOff: 'rgba(255,255,255,0.28)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const VEHICLE_MODELS = [
  { name: 'Calle Coupe', color: '#c94f42', maxSpeed: 415, kind: 'car' },
  { name: 'Solano GT', color: '#2e86c9', maxSpeed: 505, kind: 'car' },
  { name: 'Marina Sedan', color: '#7f8c99', maxSpeed: 385, kind: 'car' },
  { name: 'Palma Taxi', color: '#f6c945', maxSpeed: 395, kind: 'taxi' },
  { name: 'Brisa Convertible', color: '#e2703a', maxSpeed: 465, kind: 'car' },
  { name: 'Dockmaster Truck', color: '#5d7a52', maxSpeed: 320, kind: 'truck' },
];

export const DISTRICTS = [
  { name: 'Old Town', x: 600, y: 600 },
  { name: 'Palm Row', x: 1800, y: 1200 },
  { name: 'University Quarter', x: 3000, y: 600 },
  { name: 'Serena Marina', x: 2400, y: 2250 },
  { name: 'The Boardwalk', x: 1200, y: 2250 },
  { name: 'Port Docks', x: 3300, y: 2250 },
];

export const RADIO_STATIONS = [
  { name: 'Serena Sun FM', style: 'sun' },
  { name: 'Harbor Wave Radio', style: 'wave' },
  { name: 'Night Pier 88', style: 'night' },
];
