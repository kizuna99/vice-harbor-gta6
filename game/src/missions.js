// missions.js — six story jobs for Rio, all given by his Auntie Bea.
// Jobs run in sequence. Each job is a list of steps; a step is done when
// Rio reaches its marker the right way (on foot, in any car, or in one
// specific car). The renderer draws the marker, the minimap blip, the
// edge arrow and a light pillar from getObjective().

import { MISSION_REWARDS } from './config.js';
import { dist } from './random.js';
import { world } from './world.js';
import { makeVehicle, makePed } from './entities.js';

const A = world.anchors;

function jobDefs() {
  return [
    {
      title: 'First Run for Bea',
      brief: "Pick up Bea's parcel and drive it to Serena Marina.",
      steps: [
        { kind: 'goto', x: A.beaShop.x, y: A.beaShop.y + 70, r: 60, label: "Auntie Bea's — collect the parcel" },
        { kind: 'drive', x: A.marina.x, y: A.marina.y, r: 80, label: 'Drive the parcel to Serena Marina' },
      ],
    },
    {
      title: 'Neon Rush',
      brief: 'Five checkpoints across Palm Row before the clock dies. Bea forces dusk — the neon is the point.',
      timer: 165, forceHour: 19.3,
      steps: [1500, 2100, 2680, 2100, 1500].map((x, i) => ({
        kind: 'drive', x, y: [300, 900, 1500, 2050, 1500][i], r: 74,
        label: `Checkpoint ${i + 1} of 5`,
      })),
    },
    {
      title: 'Hot Solano',
      brief: 'A yellow Solano GT is parked up in the University Quarter. Take it. Deliver it to the Port Docks gate.',
      steps: [
        { kind: 'steal', x: 2620, y: 420, r: 60, label: 'Steal the marked Solano GT', carAt: { x: 2620, y: 420 } },
        { kind: 'drive', x: A.docks.x, y: A.docks.y, r: 90, label: 'Deliver the Solano GT to the Port Docks gate', needsMissionCar: true },
      ],
    },
    {
      title: 'VIP to the Marina',
      brief: 'Singer Lulu Mar is waiting at the Boardwalk. Get her to Serena Marina before her set starts.',
      timer: 130,
      steps: [
        { kind: 'pickup', x: 1800, y: 1560, r: 56, label: 'Pick up Lulu Mar', passengerAt: { x: 1800, y: 1560 } },
        { kind: 'drive', x: A.marina.x, y: A.marina.y, r: 85, label: 'Drive Lulu Mar to Serena Marina', needsPassenger: true },
      ],
    },
    {
      title: 'Beach Money',
      brief: 'Three debtors left cash along the Boardwalk. Collect all three — on foot, quiet-like.',
      steps: [0, 1, 2].map((i) => ({
        kind: 'collect', x: [2280, 2360, 2300][i], y: [1300, 1630, 1960][i], r: 42,
        label: `Collect cash drop ${i + 1} of 3 (on foot)`,
      })),
    },
    {
      title: 'Serena Send-Off',
      brief: 'Last job. Take the Dockmaster at the Port Docks and run it to Pier Nine. The SPD will object.',
      heatOnStart: 70,
      steps: [
        { kind: 'goto', x: A.docks.x, y: A.docks.y, r: 80, label: 'Reach the Port Docks gate' },
        { kind: 'drive', x: A.pierNine.x, y: A.pierNine.y, r: 95, label: 'Getaway: reach Pier Nine', needsAnyCar: true },
      ],
    },
  ];
}

export class Missions {
  constructor() {
    this.defs = jobDefs();
    this.index = 0;      // 0..5 active job, 6 = story complete
    this.step = 0;
    this.timer = null;   // seconds left, when the job is timed
    this.active = false;
    this.missionCar = null;
    this.passenger = null;
    this.banner = '';
    this.bannerTimer = 0;
    this.betweenTimer = 0;
  }

  get current() { return this.index < this.defs.length ? this.defs[this.index] : null; }
  get currentStep() {
    const job = this.current;
    return job ? job.steps[this.step] || null : null;
  }

  activate(game) {
    const job = this.current;
    if (!job) { this.active = false; return; }
    this.active = true;
    this.step = 0;
    this.timer = job.timer ?? null;
    this.missionCar = null;
    this.passenger = null;
    if (job.forceHour !== undefined) game.hour = job.forceHour;
    if (job.heatOnStart) game.police.addHeat(job.heatOnStart);
    this.setupStep(game);
    this.showBanner(game, `${job.title} — ${job.brief}`);
  }

  setupStep(game) {
    const s = this.currentStep;
    if (!s) return;
    if (s.kind === 'steal' && s.carAt && !this.missionCar) {
      const car = makeVehicle('solano', s.carAt.x, s.carAt.y, Math.PI / 2, 'mission');
      this.missionCar = car;
      game.vehicles.push(car);
    }
    if (s.kind === 'pickup' && s.passengerAt && !this.passenger) {
      const ped = makePed(s.passengerAt.x, s.passengerAt.y, game.rng);
      ped.color = '#ff5d8f';
      ped.state = 'wait';
      this.passenger = ped;
      game.peds.push(ped);
    }
    // The Send-Off getaway truck waits at the docks from job start.
    if (this.current && this.current.title === 'Serena Send-Off' && this.step === 0 && !this.missionCar) {
      const truck = makeVehicle('dock', world.anchors.docks.x + 60, world.anchors.docks.y + 40, 0, 'mission');
      this.missionCar = truck;
      game.vehicles.push(truck);
    }
  }

  showBanner(game, text) {
    this.banner = text;
    this.bannerTimer = 4.5;
    game.message = text;
    game.messageTimer = 4.5;
  }

  getObjective() {
    const s = this.currentStep;
    if (!this.active || !s) return null;
    // While stealing, the objective is the car itself if it has moved.
    if (s.kind === 'steal' && this.missionCar) {
      return { x: this.missionCar.x, y: this.missionCar.y, label: s.label, r: s.r };
    }
    return { x: s.x, y: s.y, label: s.label, r: s.r };
  }

  resetCurrentStep(game) {
    // Timeout / busted / wasted: restart the current step, keep the job.
    const job = this.current;
    if (!job) return;
    this.timer = job.timer ?? null;
    if (this.passenger) {
      this.passenger.isPassenger = false;
      this.passenger.state = 'stroll';
      this.passenger = null;
      // The pickup step will re-spawn her.
      if (this.currentStep && this.currentStep.kind !== 'pickup') this.step = 0;
      else this.setupStep(game);
    }
    if (job.forceHour !== undefined) game.hour = job.forceHour;
  }

  completeJob(game) {
    const reward = MISSION_REWARDS[this.index];
    game.player.cash += reward.cash;
    game.player.respect += reward.respect;
    game.stats.jobsDone++;
    game.audio?.sfx('success');
    this.showBanner(game, `Job complete: +$${reward.cash}, +${reward.respect} respect`);
    this.index++;
    this.active = false;
    this.missionCar = null;
    if (this.passenger) { this.passenger.isPassenger = false; this.passenger.state = 'stroll'; this.passenger = null; }
    game.save();
    this.betweenTimer = 2.5; // breather, then the next job activates
  }

  update(dt, game) {
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (!this.active) {
      if (this.index < this.defs.length) {
        this.betweenTimer -= dt;
        if (this.betweenTimer <= 0) this.activate(game);
      }
      return;
    }
    const job = this.current;
    const s = this.currentStep;
    if (!job || !s) { this.completeJob(game); return; }

    if (this.timer !== null) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.showBanner(game, 'Out of time — the job resets. Try again.');
        game.audio?.sfx('fail');
        this.step = 0;
        this.timer = job.timer ?? null;
        if (job.forceHour !== undefined) game.hour = job.forceHour;
        this.setupStep(game);
        return;
      }
    }

    const p = game.player;
    const obj = this.getObjective();
    const d = dist(p.x, p.y, obj.x, obj.y);
    let done = false;

    switch (s.kind) {
      case 'goto':
        done = d < s.r;
        break;
      case 'drive':
        if (s.needsMissionCar) done = p.inCar === this.missionCar && d < s.r;
        else if (s.needsPassenger) done = !!p.passengerAboard && p.inCar && d < s.r;
        else if (s.needsAnyCar) done = !!p.inCar && d < s.r;
        else done = !!p.inCar && d < s.r;
        break;
      case 'collect':
        done = !p.inCar && d < s.r;
        if (done) game.audio?.sfx('pickup');
        break;
      case 'steal':
        done = p.inCar === this.missionCar;
        break;
      case 'pickup': {
        if (d < s.r && this.passenger) {
          if (p.inCar) {
            this.passenger.isPassenger = true;
            p.passengerAboard = true;
            done = true;
          } else if (d < 30) {
            game.message = 'Lulu needs a car — bring one to her.';
            game.messageTimer = 1.2;
          }
        }
        break;
      }
      default:
        break;
    }

    if (done) {
      this.step++;
      if (this.step >= job.steps.length) this.completeJob(game);
      else {
        game.audio?.sfx('pickup');
        this.setupStep(game);
      }
    }
  }
}
