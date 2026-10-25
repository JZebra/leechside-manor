// Balance sim: bots play each day through the real Ward model.
//   npm run sim [runs]      (vite-node imports the TypeScript model directly)
// Walking is approximated: the bot heads for a spot along an L-shaped path at the
// doctor's speed ÷ DETOUR (slower with a stretcher), ticking the ward as it goes. On
// the way it can slip on fed leeches (the real footing check) and is held up by orderlies.
//
// Bots:
//   idle      — never moves (the floor of the scoring)
//   broussais — three leeches on every man, a bandage in the green; warms a chilled man only
//               after he refuses a leech
//   careful   — leeches by type (one for the pale and the drummers), warms the chilled
//               first, stands by the nervous, pumps when the jar runs low, salts eagerly

import { CONFIG } from '../src/config';
import { Ward, type Target, type WardEvent } from '../src/model/ward';
import { BED, type StationId } from '../src/model/layout';
import type { Patient } from '../src/model/patient';

const STEP = 0.1;
// a human is slower than a bot: a moment to see and press, and detours round the furniture
const THINK = Number(process.env.THINK ?? 0.35);
const DETOUR = Number(process.env.DETOUR ?? 1.3);

class Driver {
  events: WardEvent[] = [];
  constructor(readonly w: Ward) {}
  get done() {
    return this.w.over;
  }
  tick() {
    this.events.push(...this.w.tick(STEP));
  }
  wait(seconds: number) {
    for (let t = 0; t < seconds && !this.done; t += STEP) this.tick();
  }
  // Head for (x, y) along an L-shaped path; trip on leeches and wait for orderlies on the way.
  goTo(x: number, y: number) {
    const w = this.w;
    const d = w.doctor;
    for (let guard = 0; guard < 400 && !this.done; guard++) {
      if (d.dazed > 0) {
        this.tick();
        continue;
      }
      const dx = x - d.x;
      const dy = y - d.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
      const speed = (CONFIG.doctor.speed * (w.hand?.kind === 'stretcher' ? CONFIG.doctor.carrying : 1)) / DETOUR;
      const step = speed * STEP;
      const nx = Math.abs(dx) > 0.5 ? d.x + Math.sign(dx) * Math.min(step, Math.abs(dx)) : d.x;
      const ny = Math.abs(dx) > 0.5 ? d.y : d.y + Math.sign(dy) * Math.min(step, Math.abs(dy));
      const blocked = w.orderlies.some((o) => Math.abs(o.x - nx) < 12 && Math.abs(o.y - ny) < 7);
      if (!blocked) {
        d.x = nx;
        d.y = ny;
        this.events.push(...w.checkFooting());
      }
      this.tick();
    }
  }
  toBed(i: number) {
    const b = this.w.layout.beds[i];
    this.goTo(b.x + BED.w / 2, b.y < 100 ? b.y + BED.h + 11 : b.y - 2);
    this.w.doctor.facing = b.y < 100 ? 'up' : 'down';
  }
  toStation(id: StationId) {
    const u = this.w.layout.stations[id].use;
    this.goTo(u.x + u.w / 2, u.y + u.h + 3);
    this.w.doctor.facing = 'up';
  }
  act(t: Target) {
    this.wait(THINK);
    if (this.w.doctor.dazed > 0) return [];
    return this.w.interact(t);
  }
  bed(i: number): Target {
    return { kind: 'bed', bed: i };
  }
  station(id: StationId): Target {
    return { kind: 'station', id };
  }
  // put down whatever is in hand at its home
  stow() {
    const h = this.w.hand;
    if (!h) return;
    const home: Record<string, StationId> = { leech: 'jar', bandage: 'cupboard', bottle: 'stove', bdello: 'stand', used: 'bucket', stretcher: 'door' };
    this.toStation(home[h.kind]);
    for (let n = 0; n < 4 && this.w.hand; n++) this.act(this.station(home[h.kind]));
  }
}

const owed = (p: Patient) => p.leeches.reduce((s, l) => s + (l ? (1 - l.fed) * CONFIG.leech.feedSeconds * CONFIG.leech.extraction : 0), 0);

type Bot = (d: Driver) => void;

const idle: Bot = (d) => d.wait(1e9);

function makeBot(opts: { leechesFor: (p: Patient) => number; careful: boolean }): Bot {
  return (d) => {
    const w = d.w;
    while (!d.done) {
      if (w.doctor.dazed > 0) {
        d.wait(STEP);
        continue;
      }
      const beds = w.beds.map((b, i) => ({ b, i, p: b.patient })).filter((x) => x.p && x.b.leaving <= 0);
      // 1. the fainted go out first: they block a bed
      const fainted = beds.find((x) => x.p!.state === 'fainted');
      if (fainted) {
        d.stow();
        d.toBed(fainted.i);
        d.act(d.bed(fainted.i));
        if (w.hand?.kind === 'stretcher') {
          d.toStation('door');
          d.act(d.station('door'));
        }
        continue;
      }
      const active = beds.filter((x) => x.p!.active);
      // 2. a bandage for whoever is in (or about to be in) the green, worst first
      const toBandage = active
        .filter((x) => x.p!.zone() !== 'red' || (x.p!.blood + owed(x.p!) >= x.p!.spec.green[0] + 0.02 && x.p!.blood > x.p!.spec.green[0] - 0.12))
        .sort((a, b) => b.p!.blood / b.p!.spec.faintAt - a.p!.blood / a.p!.spec.faintAt);
      if (toBandage.length) {
        const x = toBandage[0];
        if (w.hand?.kind !== 'bandage') {
          d.stow();
          d.toStation('cupboard');
          d.act(d.station('cupboard'));
        }
        d.toBed(x.i);
        for (let n = 0; n < 80 && x.p!.active && x.p!.zone() === 'red'; n++) d.wait(STEP);
        if (x.p!.active) d.act(d.bed(x.i));
        continue;
      }
      // 3. the careful warm a chilled man before anything else
      const chilled = active.find((x) => x.p!.chilled);
      if (opts.careful && chilled) {
        if (w.hand?.kind !== 'bottle') {
          d.stow();
          d.toStation('stove');
          d.act(d.station('stove'));
        }
        d.toBed(chilled.i);
        d.act(d.bed(chilled.i));
        continue;
      }
      // 4. leeches (or the machine) where they're wanted
      const wanting = active
        .filter((x) => x.p!.attachedCount < opts.leechesFor(x.p!) && x.p!.blood + owed(x.p!) < x.p!.spec.green[0])
        .sort((a, b) => a.p!.patience - b.p!.patience);
      if (wanting.length) {
        const x = wanting[0];
        const lowJar = w.supply.jar <= (w.supply.deliveries ? 1 : 3);
        if (opts.careful && lowJar && (w.deviceOnStand || w.hand?.kind === 'bdello') && !x.p!.chilled) {
          if (w.hand?.kind !== 'bdello') {
            d.stow();
            d.toStation('stand');
            d.act(d.station('stand'));
          }
          d.toBed(x.i);
          const goal = (x.p!.spec.green[0] + x.p!.spec.green[1]) / 2;
          while (!d.done && x.p!.active && x.p!.blood < goal && w.doctor.dazed <= 0) {
            d.events.push(...w.pump(x.i, STEP));
            d.tick();
          }
          continue;
        }
        if (w.hand?.kind !== 'leech') {
          d.stow();
          d.toStation('jar');
          if (w.supply.jar <= 0) {
            d.wait(1);
            continue;
          }
          const want = Math.min(CONFIG.doctor.handful, opts.leechesFor(x.p!) - x.p!.attachedCount);
          for (let n = 0; n < want && w.supply.jar > 0; n++) d.act(d.station('jar'));
          if (!w.hand) continue;
        }
        d.toBed(x.i);
        if (x.p!.chilled) {
          // refused: back with the leeches, then a hot-water bottle
          d.act(d.bed(x.i));
          d.stow();
          d.toStation('stove');
          d.act(d.station('stove'));
          d.toBed(x.i);
          d.act(d.bed(x.i));
          continue;
        }
        while (w.hand?.kind === 'leech' && w.check(d.bed(x.i)).ok && x.p!.attachedCount < opts.leechesFor(x.p!)) d.act(d.bed(x.i));
        continue;
      }
      // 5. catch escapees
      if (w.escapees.length && (!w.hand || (w.hand.kind === 'leech' && w.hand.count < CONFIG.doctor.handful))) {
        const e = w.escapees[0];
        d.goTo(e.x, e.y);
        if (w.escapees.includes(e)) d.act({ kind: 'escapee', id: e.id });
        continue;
      }
      // 6. sweep and salt
      if (w.floor.length >= (opts.careful ? 2 : 4)) {
        d.stow();
        const f = w.floor[0];
        d.goTo(f.x, f.y + 5);
        d.act({ kind: 'used', id: f.id });
        d.toStation('bucket');
        d.act(d.station('bucket'));
        continue;
      }
      // 7. stand by a nervous man
      const nervous = active.find((x) => x.p!.type === 'nervous' && x.p!.panic > 0.3);
      if (opts.careful && nervous) {
        d.toBed(nervous.i);
        d.wait(1);
        continue;
      }
      if (w.hand?.kind === 'leech' || w.hand?.kind === 'used') d.stow();
      d.wait(0.3);
    }
  };
}

const broussais = makeBot({ leechesFor: () => 3, careful: false });
const careful = makeBot({
  leechesFor: (p) => ({ soldier: 3, anemic: 1, drummer: 1, nervous: 2 })[p.type],
  careful: true,
});

const BOTS: Record<string, Bot> = { idle, broussais, careful };

function run(bot: Bot, seed: string, day: number) {
  const w = new Ward(seed, day);
  bot(new Driver(w));
  const log = w.shift.log;
  const n = (o: string) => log.filter((e) => e.outcome === o).length;
  return {
    money: w.shift.money,
    verdict: w.shift.verdict(),
    green: n('green'),
    faint: n('faint'),
    walked: n('walkedOut'),
    lost: w.lost,
    slips: w.slips,
    applied: w.applied,
    jarEnd: w.supply.jar,
  };
}

const runs = Number(process.argv[2]) || 30;
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`${runs} runs per bot per day · think ${THINK}s · detour ×${DETOUR}\n`);
CONFIG.days.forEach((day, di) => {
  console.log(`${day.title}  (${day.realSeconds}s · approved ≥ ${day.verdict.approved}, noted ≥ ${day.verdict.noted})`);
  console.log(['  bot'.padEnd(11), 'francs', '  min', '  max', 'APPR', 'NOTE', 'REPR', 'green', 'faint', 'walk', 'lost', 'slips', 'leech', 'jar@6'].map((s) => pad(s, 6)).join(' '));
  for (const [name, bot] of Object.entries(BOTS)) {
    const rs = Array.from({ length: runs }, (_, i) => run(bot, `sim${i}`, di));
    const avg = (k: keyof (typeof rs)[0]) => (rs.reduce((s, r) => s + (r[k] as number), 0) / rs.length).toFixed(1);
    const pct = (v: string) => `${Math.round((rs.filter((r) => r.verdict === v).length / rs.length) * 100)}%`;
    const money = rs.map((r) => r.money);
    console.log([
      `  ${name}`.padEnd(11), avg('money'), Math.min(...money), Math.max(...money), pct('APPROVED'), pct('NOTED'), pct('REPRIMAND'),
      avg('green'), avg('faint'), avg('walked'), avg('lost'), avg('slips'), avg('applied'), avg('jarEnd'),
    ].map((s) => pad(s, 6)).join(' '));
  }
  console.log('');
});
