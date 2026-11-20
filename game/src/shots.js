// Staged screenshot scenes. ?shot=cover|chase|mission|finale&seed=7
// arranges Port Serena into a composed tableau while the ordinary
// simulation keeps running underneath, so every capture is live.

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
      // Golden hour, Palm Row: Rio cruising with job one under way.
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
      // Five stars at night, Air One overhead, Solano lit by sirens.
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
      // Boardwalk on foot, mid-collection in Beach Money.
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
      // Night run down Ocean Drive in the Dockmaster, Pier Nine ahead.
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
}
