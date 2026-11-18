// shots.js — deterministic staged scenes for the four hand-in screenshots.
// Selected with ?shot=cover|chase|mission|finale&seed=7. Each scene sets the
// clock, Rio's position, traffic dressing and the active job so the capture
// demonstrates a real feature instead of a random frame.

import { world } from './world.js';
import { makeVehicle } from './entities.js';

function placeInCar(game, modelId, x, y, angle, speed = 0) {
  const car = makeVehicle(modelId, x, y, angle, 'player');
  car.speed = speed;
  game.vehicles.push(car);
  game.player.inCar = car;
  game.player.x = x; game.player.y = y; game.player.angle = angle;
  game.camera.x = x; game.camera.y = y;
  return car;
}

function dressTraffic(game, spots) {
  // A few civilian cars parked/driving near the camera for depth.
  for (const [modelId, x, y, angle] of spots) {
    const car = makeVehicle(modelId, x, y, angle, 'traffic');
    car.waypoint = null;
    game.vehicles.push(car);
  }
}

export function applyShot(game, name) {
  game.screen = 'play';
  game.missions.active = false;
  game.missions.betweenTimer = 9999; // hold the staged job state

  switch (name) {
    case 'cover': {
      // Golden-hour drive through Palm Row, first job on the panel.
      game.hour = 17.7;
      game.missions.index = 0;
      game.missions.active = true;
      game.missions.step = 1;
      placeInCar(game, 'palma', 1500, 560, Math.PI / 2, 120);
      dressTraffic(game, [
        ['taxi', 1500, 300, Math.PI / 2],
        ['calle', 1620, 900, -Math.PI / 2],
        ['palma', 900, 640, 0],
      ]);
      break;
    }
    case 'chase': {
      // Five-star night pursuit: cruisers front and back, helicopter up.
      game.hour = 23.4;
      game.missions.index = 2;
      game.missions.active = true;
      game.missions.step = 1;
      placeInCar(game, 'calle', 1500, 1180, Math.PI / 2, 200);
      game.setWanted(5);
      // Hand-place the first responders so the frame is instantly readable;
      // the police system keeps the pressure on from there.
      const spots = [[1380, 1080, Math.PI / 2], [1640, 1300, Math.PI / 2], [1500, 1420, -Math.PI / 2]];
      for (const [x, y, a] of spots) {
        const cop = makeVehicle('cruiser', x, y, a, 'police');
        cop.speed = 150;
        game.police.cars.push(cop);
        game.vehicles.push(cop);
      }
      game.police.heli.active = true;
      game.police.heli.x = game.player.x - 130;
      game.police.heli.y = game.player.y - 120;
      break;
    }
    case 'mission': {
      // On-foot Boardwalk cash collection, objective arrow in play.
      game.hour = 10.6;
      game.missions.index = 4;
      game.missions.active = true;
      game.missions.step = 0;
      game.player.x = 2190; game.player.y = 1330;
      game.player.angle = 0.5;
      game.camera.x = game.player.x; game.camera.y = game.player.y;
      dressTraffic(game, [
        ['taxi', 2680, 1180, Math.PI / 2],
        ['dock', 2920, 1700, Math.PI / 2],
      ]);
      break;
    }
    case 'finale': {
      // Night getaway: Dockmaster on Ocean Drive, Pier Nine ahead, 3 stars.
      game.hour = 22.8;
      game.missions.index = 5;
      game.missions.active = true;
      game.missions.step = 1;
      placeInCar(game, 'dock', world.oceanDriveX, 1760, -Math.PI / 2, 95);
      game.setWanted(3);
      const cop = makeVehicle('cruiser', world.oceanDriveX - 10, 2010, -Math.PI / 2, 'police');
      cop.speed = 118;
      game.police.cars.push(cop);
      game.vehicles.push(cop);
      game.police.heli.active = true;
      game.police.heli.x = game.player.x - 110;
      game.police.heli.y = game.player.y + 140;
      break;
    }
    default:
      break;
  }
  // Snap the staged job's step data without spawning pickup actors twice.
  const step = game.missions.currentStep;
  void step;
}
