// shots.js — the four staged scenes behind ?shot=cover|chase|mission|finale.
// Each one arranges the REAL game (same cars, same cops, same harbour) into
// the moment the screenshot is named for, settles it with a few honest
// simulation steps, and leaves it ready to photograph. Same seed, same
// frame, every time.

function settle(game, steps = 26) {
  // A few fixed steps let traffic roll and the camera find its subject
  // without any input. Weapons stay holstered; this is posing, not playing.
  const idle = { wasPressed: () => false, isDown: () => false, axis: () => ({ x: 0, y: 0 }), drain: () => {} };
  const realState = game.state;
  game.state = 'playing';
  for (let i = 0; i < steps; i++) game.update(1 / 60, idle);
  game.state = realState;
}

// Borrow a few ambient cars and walkers and park them inside the frame, so
// a staged scene has the density of a lived-in street and not a car park.
function dressSet(game, cx, cy) {
  const spareCars = game.cars.filter((c) => !c.police && !c.wrecked && c !== game.player.car);
  const spots = [[-190, -120], [210, 90], [-260, 130], [150, -190], [330, -40]];
  spareCars.slice(0, spots.length).forEach((car, i) => {
    car.x = cx + spots[i][0]; car.y = cy + spots[i][1];
    car.parked = false; car.driver = true; car.speed = 60 + i * 17;
    car.angle = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  const walkers = game.peds.filter((p) => !p.down);
  const corners = [[-120, -60], [90, 120], [-60, 170], [180, -110]];
  walkers.slice(0, corners.length).forEach((ped, i) => {
    ped.x = cx + corners[i][0]; ped.y = cy + corners[i][1];
  });
}

function putInCar(game, x, y, angle, typeIdx) {
  let car = game.cars.find((c) => !c.police && !c.wrecked && c.typeIdx === (typeIdx ?? 0));
  if (!car) car = game.cars.find((c) => !c.wrecked);
  car.x = x; car.y = y; car.angle = angle; car.speed = 0; car.parked = false; car.driver = true;
  game.player.car = car;
  game.player.x = x; game.player.y = y;
  game.camera.x = x; game.camera.y = y;
  return car;
}

export function stageShot(game, name) {
  game.state = 'playing'; // painted directly by the boot code, HUD and all
  if (name === 'cover') {
    game.hour = 17.7; // golden hour on Palm Row
    game.missions.jobIndex = 0; game.missions.stepIndex = 0; game.missions.armed = false;
    const car = putInCar(game, 1300, 614, Math.PI / 2, 0);
    car.speed = 120;
    dressSet(game, 1300, 614);
    game.cash = 240; game.respect = 5;
  } else if (name === 'chase') {
    game.hour = 23.2;
    const car = putInCar(game, 1800, 1014, Math.PI / 2, 1);
    car.speed = 190;
    game.setWanted(5);
    // Converging cruisers, frozen a breath from the frame.
    const pol = game.policeRef;
    pol.cars.length = 0;
    const spots = [[1620, 940], [1980, 1080], [1740, 1160], [2060, 920], [1500, 1090]];
    for (const [x, y] of spots) {
      pol.cars.push({ x, y, angle: Math.atan2(game.player.x - x, -(game.player.y - y)), speed: 140, roadblock: false, wrecked: false, hp: 160, police: true, driver: true, parked: false, color: '#e8ecf2', airZ: 0, damage: 0 });
    }
    pol.heli = { x: game.player.x - 120, y: game.player.y - 160, angle: 1 };
    game.cash = 860; game.respect = 31;
  } else if (name === 'mission') {
    game.hour = 10.6;
    game.player.car = null;
    game.player.x = 1360; game.player.y = 2180;
    game.camera.x = game.player.x; game.camera.y = game.player.y;
    game.missions.jobIndex = 4; game.missions.stepIndex = 1; game.missions.armed = false;
    game.cash = 1090; game.respect = 38;
    game.player.armor = 65; game.player.weapon = 'pistol';
    game.arsenal.owned.pistol = true;
    dressSet(game, 1360, 2180);
  } else { // finale
    game.hour = 21.9;
    const car = putInCar(game, 2380, 1386, Math.PI / 2, 4);
    car.speed = 165;
    game.missions.jobIndex = 5; game.missions.stepIndex = 1; game.missions.armed = false;
    game.setWanted(3);
    game.policeRef.heli = { x: 2260, y: 1230, angle: 2 };
    game.cash = 1710; game.respect = 52;
  }
  settle(game);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
}
