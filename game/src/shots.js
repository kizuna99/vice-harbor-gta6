// Deterministic staged scenes for the hand-in screenshots.
// Open the game with ?shot=cover|chase|mission|finale&seed=7 and the
// city arranges itself into a composed, reproducible tableau while
// the normal simulation keeps running underneath.

import { reseed } from './random.js';
import { setWantedLevel } from './police.js';
import { missions } from './missions.js';
import { makeVehicle } from './entities.js';

export function parseShotRequest() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  return { shot, seed };
}

export function stageScene(game, request) {
  reseed(request.seed * 1000 + 17);
  const p = game.player;
  game.state = 'playing';
  game.started = true;

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
      // Five-star night pursuit downtown with the helicopter overhead.
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
      // On foot on the Boardwalk, mid-collection in Beach Money, with
      // the objective pillar and edge guidance visible.
      game.hour = 11.4;
      missions.jobIndex = 4; missions.stepIndex = 1; missions.done = false;
      missions.timerMax = 0; missions.timer = 0;
      p.car = null;
      p.x = 1740; p.y = 1500; p.angle = Math.PI / 2;
      game.camera.x = p.x; game.camera.y = p.y;
      game.cash = 2070; game.respect = 52;
      break;
    }
    case 'finale': {
      // Night run down Ocean Drive in the Dockmaster, three stars,
      // Pier Nine lit at the end of the road.
      game.hour = 21.6;
      missions.jobIndex = 5; missions.stepIndex = 1; missions.done = false;
      missions.timerMax = 120; missions.timer = 74;
      let truck = game.cars.find((c) => c.model.id === 'truck');
      if (!truck) {
        truck = makeVehicle(4, 1900, 1560, Math.PI / 2, '#7a8b6f');
        game.cars.push(truck);
      }
      truck.x = 1900; truck.y = 1584; truck.angle = Math.PI / 2; truck.speed = 150;
      truck.parked = false; truck.driver = true;
      p.car = truck; p.x = truck.x; p.y = truck.y; p.angle = truck.angle;
      game.camera.x = truck.x; game.camera.y = truck.y;
      setWantedLevel(3);
      game.cash = 2470; game.respect = 62;
      break;
    }
    default:
      break;
  }
  // Refresh the step timer/pillar bookkeeping for the staged job.
  const job = missions.done ? null : undefined;
  void job;
}
