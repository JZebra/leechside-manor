// Balance sim: bots play whole shifts through the real Ward model.
//   npm run sim [runs]        (vite-node, so it imports the TypeScript model directly)
// Walking is approximated: the bot "walks" to a spot by ticking the ward for the
// travel time (Manhattan distance / speed, slower with a stretcher), then stands there.
//
// Bots:
//   idle      — never moves (the floor of the scoring)
//   broussais — three leeches on every man, lint in the green; ignores types
//   careful   — leeches by type (one for the pale and the drummers), warms the stubborn,
//               stands by the nervous, uses the bdellometer when the jar is low, salts the fed

import { CONFIG } from '../src/config';
import { Ward, type Target } from '../src/model/ward';
import { BEDS, BED, STATIONS, type StationId } from '../src/model/layout';
import type { Patient } from '../src/model/patient';

const STEP = 0.1;
// a human is slower than a bot: a moment to see and press, and detours round the furniture
const THINK = Number(process.env.THINK ?? 0.35);
const DETOUR = Number(process.env.DETOUR ?? 1.3);

class Driver {
  constructor(readonly w: Ward) {}
  get done() {
    return this.w.over;
  }
  wait(seconds: number) {
    for (let t = 0; t < seconds && !this.done; t += STEP) this.w.tick(STEP);
  }
  goTo(x: number, y: number) {
    const d = this.w.doctor;
    const speed = CONFIG.doctor.speed * (this.w.hand?.kind === 'stretcher' ? CONFIG.doctor.carrying : 1);
    const time = ((Math.abs(x - d.x) + Math.abs(y - d.y)) * DETOUR) / speed;
    const x0 = d.x, y0 = d.y;
    for (let t = 0; t < time && !this.done; t += STEP) {
      d.x = x0 + ((x - x0) * t) / time;
      d.y = y0 + ((y - y0) * t) / time;
      this.w.tick(STEP);
    }
    d.x = x;
    d.y = y;
  }
  toBed(i: number) {
    const b = BEDS[i];
    this.goTo(b.x + BED.w / 2, b.y < 100 ? b.y + BED.h + 6 : b.y - 4);
  }
  toStation(id: StationId) {
    const s = STATIONS[id].box;
    this.goTo(s.x + s.w / 2, id === 'door' ? s.y + s.h + 6 : s.y + s.h + 5);
  }
  act(t: Target) {
    this.wait(THINK);
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
    const home: Record<string, StationId> = { leech: 'jar', lint: 'cupboard', sugar: 'stove', bdello: 'stand', used: 'bucket', stretcher: 'door' };
    this.toStation(home[h.kind]);
    this.act(this.station(home[h.kind]));
  }
}

const owed = (p: Patient) => p.leeches.reduce((s, l) => s + (l ? (1 - l.fed) * CONFIG.leech.feedSeconds * CONFIG.leech.extraction : 0), 0);

type Bot = (d: Driver) => void;

const idle: Bot = (d) => d.wait(1e9);

function makeBot(opts: { leechesFor: (p: Patient) => number; careful: boolean }): Bot {
  return (d) => {
    const w = d.w;
    while (!d.done) {
      const beds = w.beds.map((b, i) => ({ b, i, p: b.patient })).filter((x) => x.p && x.b.leaving <= 0);
      // 1. the fainted go out first: they block a bed
      const fainted = beds.find((x) => x.p!.state === 'fainted');
      if (fainted) {
        d.stow();
        d.toBed(fainted.i);
        d.act(d.bed(fainted.i));
        d.toStation('door');
        d.act(d.station('door'));
        continue;
      }
      const active = beds.filter((x) => x.p!.active);
      // 2. lint for whoever is in (or about to be in) the green, worst first
      const lintable = active
        .filter((x) => x.p!.zone() !== 'red' || x.p!.blood + owed(x.p!) >= x.p!.spec.green[0] + 0.02 && x.p!.blood > x.p!.spec.green[0] - 0.12)
        .sort((a, b) => b.p!.blood / b.p!.spec.faintAt - a.p!.blood / a.p!.spec.faintAt);
      if (lintable.length) {
        const x = lintable[0];
        if (w.hand?.kind !== 'lint') {
          d.stow();
          d.toStation('cupboard');
          d.act(d.station('cupboard'));
        }
        d.toBed(x.i);
        // wait for the green if he's not quite there
        for (let n = 0; n < 80 && x.p!.active && x.p!.zone() === 'red'; n++) d.wait(STEP);
        if (x.p!.active) d.act(d.bed(x.i));
        continue;
      }
      // 3. leeches where they're wanted
      const wanting = active
        .filter((x) => x.p!.attachedCount < opts.leechesFor(x.p!) && x.p!.blood + owed(x.p!) < x.p!.spec.green[0])
        .sort((a, b) => a.p!.patience - b.p!.patience);
      if (wanting.length) {
        const x = wanting[0];
        if (opts.careful && w.supply.jar <= 1 && w.deviceOnStand !== undefined && (w.deviceOnStand || w.hand?.kind === 'bdello')) {
          // the machine: pump him into the green, then lint
          if (w.hand?.kind !== 'bdello') {
            d.stow();
            d.toStation('stand');
            d.act(d.station('stand'));
          }
          d.toBed(x.i);
          const goal = (x.p!.spec.green[0] + x.p!.spec.green[1]) / 2;
          while (!d.done && x.p!.active && x.p!.blood < goal) {
            w.pump(x.i, STEP);
            w.tick(STEP);
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
          // a handful: as many as he still wants
          const want = opts.leechesFor(x.p!) - x.p!.attachedCount;
          for (let n = 0; n < want && w.check(d.station('jar')).ok; n++) {
            d.act(d.station('jar'));
            const h = w.hand as { held: boolean[] } | null;
            if (h?.held.some((s) => s) && !opts.careful) d.act(d.station('jar')); // the stubborn one goes back
          }
          if (!w.hand) continue;
        }
        const hand = w.hand;
        if (hand?.kind === 'leech' && hand.held.every((s) => s) && !x.p!.prepared) {
          // only sulkers left: put them back, or warm him first
          d.toStation('jar');
          d.act(d.station('jar'));
          if (opts.careful) {
            d.toStation('stove');
            d.act(d.station('stove'));
            d.toBed(x.i);
            d.act(d.bed(x.i));
          }
          continue;
        }
        d.toBed(x.i);
        while (w.hand?.kind === 'leech' && w.check(d.bed(x.i)).ok && x.p!.attachedCount < opts.leechesFor(x.p!)) d.act(d.bed(x.i));
        continue;
      }
      // 4. catch escapees
      if (w.escapees.length && !w.hand) {
        d.stow();
        const e = w.escapees[0];
        d.goTo(e.x, e.y);
        if (w.escapees.includes(e)) {
          d.act({ kind: 'escapee', id: e.id });
          d.stow();
        }
        continue;
      }
      // 5. sweep and salt
      if (w.floor.length >= (opts.careful ? 2 : 4)) {
        d.stow();
        const f = w.floor[0];
        d.goTo(f.x, f.y);
        d.act({ kind: 'used', id: f.id });
        d.toStation('bucket');
        d.act(d.station('bucket'));
        continue;
      }
      // 6. stand by a nervous man
      const nervous = active.find((x) => x.p!.type === 'nervous' && x.p!.panic > 0.3);
      if (opts.careful && nervous) {
        d.toBed(nervous.i);
        d.wait(1);
        continue;
      }
      d.wait(0.3);
    }
  };
}

const broussais = makeBot({ leechesFor: () => 3, careful: false });
const careful = makeBot({
  leechesFor: (p) => ({ soldier: 3, anaemic: 1, drummer: 1, nervous: 2 })[p.type],
  careful: true,
});

const BOTS: Record<string, Bot> = { idle, broussais, careful };

const faintsBy: Record<string, number> = {};
function run(bot: Bot, seed: string) {
  const w = new Ward(seed);
  const tick = w.tick.bind(w);
  const pump = w.pump.bind(w);
  const note = (evs: ReturnType<Ward['tick']>) => {
    for (const e of evs) {
      if (e.kind === 'faint') {
        const p = w.beds[e.bed].patient!;
        const wild = p.leeches.some((l) => l?.wild);
        const k = `${p.type}/${e.cause}${wild ? '/wild' : ''}/${w.shift.stage}`;
        faintsBy[k] = (faintsBy[k] ?? 0) + 1;
      }
    }
    return evs;
  };
  w.tick = (dt: number) => note(tick(dt));
  w.pump = (bed: number, dt: number) => note(pump(bed, dt));
  bot(new Driver(w));
  const log = w.shift.log;
  const n = (o: string) => log.filter((e) => e.outcome === o).length;
  return {
    money: w.shift.money,
    verdict: w.shift.verdict(),
    green: n('green'),
    early: n('early'),
    late: n('late'),
    faint: n('faint'),
    walked: n('walkedOut'),
    lost: w.lost,
    applied: w.applied,
    patients: log.length,
  };
}

const runs = Number(process.argv[2]) || 40;
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`${runs} shifts per bot · think ${THINK}s, detour ×${DETOUR} · ${CONFIG.shift.realSeconds}s per shift · verdict: approved ≥ ${CONFIG.score.verdict.approved}, noted ≥ ${CONFIG.score.verdict.noted}\n`);
console.log(['bot'.padEnd(10), 'francs', '  min', '  max', 'APPR', 'NOTE', 'REPR', 'green', 'early', ' late', 'faint', 'walk', 'lost', 'leech'].map((s) => pad(s, 6)).join(' '));
for (const [name, bot] of Object.entries(BOTS)) {
  const rs = Array.from({ length: runs }, (_, i) => run(bot, `sim${i}`));
  const avg = (k: keyof (typeof rs)[0]) => (rs.reduce((s, r) => s + (r[k] as number), 0) / rs.length).toFixed(1);
  const pct = (v: string) => `${Math.round((rs.filter((r) => r.verdict === v).length / rs.length) * 100)}%`;
  const money = rs.map((r) => r.money);
  console.log([
    name.padEnd(10), avg('money'), Math.min(...money), Math.max(...money), pct('APPROVED'), pct('NOTED'), pct('REPRIMAND'),
    avg('green'), avg('early'), avg('late'), avg('faint'), avg('walked'), avg('lost'), avg('applied'),
  ].map((s) => pad(s, 6)).join(' '));
  if (process.argv.includes('--detail') && name !== 'idle') {
    const rows = Object.entries(faintsBy).sort((a, b) => b[1] - a[1]);
    console.log('   faints by type/cause/stage:', rows.map(([k, v]) => `${k} ${(v / runs).toFixed(2)}`).join(' · '));
  }
  for (const k of Object.keys(faintsBy)) delete faintsBy[k];
}
