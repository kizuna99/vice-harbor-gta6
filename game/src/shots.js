// shots.js — the four staged scenes the screenshots are taken from.
// Each one loads the real game, seats Rio somewhere photogenic, sets
// the clock and the law, and lets the simulation run: nothing is
// faked, the camera just happens to be watching the good bit.

import { startStep } from './missions.js';

function grabCar(game, typeId, x, y, angle) {
  let car = game.cars.find((c) => c.typeId === typeId && !c.wrecked) || game.cars[0];
  car.x = x; car.y = y; car.angle = angle; car.speed = 0;
  car.parked = false; car.driver = 'player';
  game.player.car = car;
  game.player.x = x; game.player.y = y;
  game.camera.x = x; game.camera.y = y;
  return car;
}

export function applyShot(game, name) {
  game.state = 'playing';
  game.shotMode = name;
  const p = game.player;
  if (name === 'cover') {
    game.timeHours = 17.55; // golden hour on Palm Row
    const car = grabCar(game, 'sedan', 1560, 627, Math.PI / 2);
    car.speed = 46;
    startStep(game); // Bea's first job card on the HUD
  } else if (name === 'chase') {
    game.timeHours = 23.35;
    const car = grabCar(game, 'gt', 2050, 600, Math.PI / 2);
    car.speed = 130;
    game.setWanted(5);
    const pol = game.policeRef;
    pol.spawnCruiser(game, false, { x: 1900, y: 545 });
    pol.spawnCruiser(game, false, { x: 1860, y: 660 });
    pol.spawnCruiser(game, true, { x: 2520, y: 573 });
    pol.spawnCruiser(game, true, { x: 2520, y: 627 });
    pol.heli = { x: 2050, y: 420, angle: 0, phase: 1.2 };
  } else if (name === 'mission') {
    game.timeHours = 11.4;
    p.x = 1470; p.y = 2106; p.angle = -Math.PI / 2;
    game.camera.x = p.x; game.camera.y = p.y;
    game.missions.jobIndex = 4; // Beach Money, mid-collection
    game.missions.stepIndex = 0;
    startStep(game);
    game.cash = 1140; game.respect = 52;
  } else if (name === 'finale') {
    game.timeHours = 21.6;
    const car = grabCar(game, 'truck', 900, 2100, Math.PI / 2);
    car.speed = 120;
    game.setWanted(3);
    const pol = game.policeRef;
    pol.spawnCruiser(game, false, { x: 690, y: 2073 });
    pol.spawnCruiser(game, false, { x: 640, y: 2127 });
    pol.heli = { x: 900, y: 1930, angle: 0, phase: 0.4 };
    game.missions.jobIndex = 7;
    game.missions.stepIndex = 0;
    startStep(game);
  }
}
