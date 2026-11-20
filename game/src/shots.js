// Deterministic staged scenes for the hand-in screenshots.
// Open the game with ?shot=cover|chase|mission|finale&seed=21 and the
// city arranges itself into a composed, reproducible tableau while
// the normal simulation keeps running underneath. The v2 scenes show
// off the new material: the Dockside Crossfire mid-fight and the
// Searchlight Run under Air One's lamp.

import { reseed } from './random.js';
import { setWantedLevel } from './police.js';
import { missions, startJobStep } from './missions.js';
import { makeVehicle } from './entities.js';

export function parseShotRequest() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = parseInt(params.get('seed') || '21', 10) || 21;
  return { shot, seed };
}

export function stageScene(game, request) {
  reseed(request.seed * 1000 + 17);
  const p = game.player;
  game.state = 'playing';
  game.started = true;
  // Drop the fresh-game banner (job one's brief) so the staged scene's
  // own messaging is what the camera sees.
  game.bannerText = '';
  game.bannerT = 0;

  switch (request.shot) {
    case 'cover': {
      // Golden hour on Palm Row: Rio cruising past the palms with the
      // first job active and the minimap alive.
      game.hour = 17.7;
      missions.jobIndex = 0; missions.stepIndex = 1; missions.done = false;
      const car = game.cars.find((c) => !c.parked) || game.cars[0];
      car.x = 1420; car.y = 224; car.angle = Math.PI / 2; car.speed = 120;
      car.parked = false; car.driver = true;
      p.car = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      game.camera.x = car.x; game.camera.y = car.y;
      game.cash = 250;
      break;
    }
    case 'chase': {
      // Five-star night pursuit downtown with the helicopter overhead
      // and a roadblock waiting up the avenue.
      game.hour = 23.2;
      missions.jobIndex = 2; missions.stepIndex = 1; missions.done = false;
      const car = game.cars.find((c) => c.model.id === 'solano') || game.cars[1] || game.cars[0];
      car.x = 1000; car.y = 1000; car.angle = Math.PI / 2; car.speed = 190;
      car.parked = false; car.driver = true;
      p.car = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      game.camera.x = car.x; game.camera.y = car.y;
      setWantedLevel(5);
      game.cash = 1480; game.respect = 32;
      break;
    }
    case 'mission': {
      // Dockside Crossfire at dusk: Rio in the container yard, shotgun
      // up, the first Ferro wave closing in and the HUD counting the
      // crew still standing.
      game.hour = 17.9;
      missions.jobIndex = 6; missions.stepIndex = 1; missions.done = false;
      missions.wave = 0;
      game.enemies.length = 0;
      p.car = null;
      p.x = 2735; p.y = 1445; p.angle = Math.PI / 2;
      p.armor = 65;
      game.weaponsOwned.shotgun = true;
      game.ammo.shotgun.mag = 6;
      game.ammo.shotgun.reserve = 18;
      p.weapon = 'shotgun';
      game.camera.x = p.x; game.camera.y = p.y;
      startJobStep(game); // spawns wave one around the yard
      game.cash = 2920; game.respect = 72;
      break;
    }
    case 'finale': {
      // Searchlight Run: the crate is lifted, heat is pinned at four
      // stars, Air One's lamp sweeps the street and the safehouse
      // timer is burning down on the HUD.
      game.hour = 22.8;
      missions.jobIndex = 7; missions.stepIndex = 1; missions.done = false;
      let car = game.cars.find((c) => c.model.id === 'palma') || game.cars[0];
      car.x = 560; car.y = 560; car.speed = 130;
      car.angle = Math.atan2(200 - car.x, -(340 - car.y)); // toward the safehouse
      car.parked = false; car.driver = true;
      p.car = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      game.camera.x = car.x; game.camera.y = car.y;
      startJobStep(game); // applies the pinned heat
      missions.timer = 118;
      missions.timerMax = 170;
      game.cash = 3770; game.respect = 96;
      break;
    }
    default:
      break;
  }
  void makeVehicle;
}
