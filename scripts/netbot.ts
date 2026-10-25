// Bot doctors for testing the multiplayer server: each joins a room as a player would,
// readies up, and works the Grande Salle — carries out the fainted, bandages men in the
// green, salts fed leeches, sets leeches on, warms the chilled. Not clever, but busy.
//
//   npm run bots -- ABCD 3      three bots into room ABCD
//   npm run bots -- match 2     two bots into a quick-match room
//   SERVER=https://… npm run bots -- …   (default http://localhost:8787)
//   BOT_SECONDS=30 npm run bots -- …     leave after that long

import { CONFIG } from '../src/config';
import { Ward, type Target } from '../src/model/ward';
import { BED, type StationId } from '../src/model/layout';
import { applySnapshot, type PatientRecord } from '../src/net/snapshot';
import { PROTOCOL, type ClientMsg, type ServerMsg } from '../src/net/protocol';
import type { Verb } from '../src/data/lines';

const SERVER = process.env.SERVER ?? 'http://localhost:8787';
const STEP = 1 / 20;

type Spot = { x: number; y: number; facing: 'up' | 'down' };
type Job = { to: () => Spot | null; verb: Verb | Verb[]; target?: () => Target | null };

class BotDoctor {
  private ws: WebSocket;
  private ward: Ward | null = null;
  private me = 0;
  private you = '';
  private records = new Map<number, PatientRecord>();
  private jobs: Job[] = [];
  private path: { x: number; y: number }[] = [];
  private wait = 0;

  constructor(readonly name: string, code: string) {
    this.ws = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/api/room/${code}`);
    this.ws.addEventListener('open', () => this.send({ t: 'hello', name, v: PROTOCOL }));
    this.ws.addEventListener('message', (e) => this.receive(JSON.parse(String(e.data)) as ServerMsg));
    this.ws.addEventListener('close', () => console.log(`${name}: disconnected`));
    setInterval(() => this.step(), STEP * 1000);
  }

  private send(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private receive(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        this.you = m.you;
        break;
      case 'lobby': {
        const mine = m.lobby.players.find((p) => p.id === this.you);
        if (m.lobby.phase === 'lobby' && mine && !mine.ready) setTimeout(() => this.send({ t: 'ready', ready: true }), 600);
        break;
      }
      case 'start':
        this.me = m.seats.find((s) => s.id === this.you)!.doctor;
        this.ward = new Ward(m.seed, m.day, { doctors: m.seats.length, ward: CONFIG.multi.ward });
        this.records.clear();
        this.jobs = [];
        console.log(`${this.name}: the doors are open (${CONFIG.days[m.day].year}), doctor ${this.me}`);
        break;
      case 'snap':
        if (!this.ward) break;
        applySnapshot(this.ward, m.s, this.records, this.me);
        if (process.env.BOT_DEBUG && Math.floor(m.s.clock / 5) !== Math.floor((m.s.clock - 0.07) / 5)) {
          const d = this.ward.doctors[this.me];
          console.log(`${this.name} ${this.ward.shift.clockText()} ${m.s.money} fr, ${m.s.applied} applied, at ${d.x.toFixed(0)},${d.y.toFixed(0)} holding ${d.hand?.kind ?? 'nothing'}, jobs ${this.jobs.length}`);
        }
        break;
      case 'over':
        console.log(`${this.name}: the bell — ${m.report.money} fr, ${m.report.verdict}`);
        this.ward = null;
        break;
      case 'error':
        console.log(`${this.name}: refused (${m.code})`);
        break;
    }
  }

  // ── Getting about: along the aisles, and through the gaps between the stations ──

  private route(to: { x: number; y: number }) {
    const d = this.ward!.doctors[this.me];
    const TOP = 112, LOW = 228, GAPS = [118, 215, 334, 450, 560];
    const aisle = (y: number) => (y < 150 ? TOP : LOW);
    const a = aisle(d.y), b = aisle(to.y);
    const path = [{ x: d.x, y: a }];
    if (a !== b) {
      const gap = GAPS.reduce((g, x) => (Math.abs(x - (d.x + to.x) / 2) < Math.abs(g - (d.x + to.x) / 2) ? x : g));
      path.push({ x: gap, y: a }, { x: gap, y: b });
    }
    path.push({ x: to.x, y: b }, to);
    this.path = path;
  }

  private walk(): boolean {
    const w = this.ward!;
    const d = w.doctors[this.me];
    const goal = this.path[0];
    if (!goal) return true;
    const dx = goal.x - d.x, dy = goal.y - d.y;
    if (Math.hypot(dx, dy) < 1.5) {
      this.path.shift();
      return !this.path.length;
    }
    const before = { x: d.x, y: d.y };
    const across = Math.abs(dx) > 1; // one axis at a time, never past the waypoint
    const left = across ? Math.abs(dx) : Math.abs(dy);
    w.glide(across ? Math.sign(dx) : 0, across ? 0 : Math.sign(dy), Math.min(STEP, left / CONFIG.doctor.speed), false, this.me);
    if (Math.hypot(d.x - before.x, d.y - before.y) < 0.2) this.path.unshift({ x: d.x + (Math.random() - 0.5) * 30, y: d.y + (Math.random() - 0.5) * 20 }); // stuck: sidestep
    this.send({ t: 'move', x: d.x, y: d.y, run: false, facing: d.facing, flip: d.flip, ix: Math.sign(dx), iy: Math.sign(dy) });
    return false;
  }

  private bedSpot(i: number): Spot {
    const b = this.ward!.layout.beds[i];
    return b.y < 150 ? { x: b.x + BED.w / 2, y: b.y + BED.h + 11, facing: 'up' } : { x: b.x + BED.w / 2, y: b.y - 2, facing: 'down' };
  }

  private stationSpot(id: StationId): Spot {
    const u = this.ward!.layout.stations[id].use;
    return id === 'door' ? { x: u.x + u.w / 2, y: 36, facing: 'up' } : { x: u.x + u.w / 2, y: u.y + u.h + 3, facing: 'up' };
  }

  // ── Deciding ──

  private plan() {
    const w = this.ward!;
    const d = w.doctors[this.me];
    const at = (s: StationId) => () => this.stationSpot(s);
    const bed = (i: number) => () => (w.beds[i].patient ? this.bedSpot(i) : null);
    const hand = d.hand;
    if (hand) {
      const home: Record<string, StationId> = { leech: 'jar', bandage: 'cupboard', bottle: 'stove', bdello: 'stand', used: 'bucket', stretcher: 'door' };
      const want = (pred: (i: number) => boolean) => w.beds.findIndex((b, i) => b.patient?.active && b.leaving <= 0 && pred(i));
      let i = -1;
      const red = w.beds.filter((b) => b.patient?.active && !b.patient.chilled && b.patient.zone() === 'red' && b.patient.attachedCount < 2).length;
      const tg = w.target(this.me);
      if (hand.kind === 'leech' && hand.count < Math.min(2, red) && tg?.check.ok && tg.check.verb === 'takeLeech') {
        return void this.jobs.push({ to: at('jar'), verb: 'takeLeech' }); // another, while he's at the jar
      }
      if (hand.kind === 'leech') i = want((j) => !w.beds[j].patient!.chilled && w.beds[j].patient!.attachedCount < 2 && w.beds[j].patient!.zone() === 'red');
      if (hand.kind === 'bandage') i = want((j) => w.beds[j].patient!.zone() !== 'red');
      if (hand.kind === 'bottle') i = want((j) => w.beds[j].patient!.chilled);
      if (i >= 0) this.jobs.push({ to: bed(i), verb: ['apply', 'bandage', 'warm'], target: () => ({ kind: 'bed', bed: i }) });
      else this.jobs.push({ to: at(home[hand.kind]), verb: ['putBack', 'putBackAll', 'salt', 'deliver'] });
      return;
    }
    const fainted = w.beds.findIndex((b) => b.patient?.state === 'fainted');
    if (fainted >= 0) return void this.jobs.push({ to: bed(fainted), verb: 'lift' });
    const green = w.beds.findIndex((b) => b.patient?.active && b.leaving <= 0 && b.patient.zone() === 'green');
    if (green >= 0) return void this.jobs.push({ to: at('cupboard'), verb: 'takeBandage' });
    const f = w.floor[Math.floor(Math.random() * w.floor.length)];
    if (f && Math.random() < 0.5) return void this.jobs.push({ to: () => ({ x: f.x, y: f.y + 6, facing: 'up' }), verb: 'scoop' });
    const chilled = w.stoveIn && w.beds.some((b) => b.patient?.active && b.patient.chilled);
    if (chilled && Math.random() < 0.5) return void this.jobs.push({ to: at('stove'), verb: 'takeBottle' });
    if (w.supply.jar > 0 && w.beds.some((b) => b.patient?.active && !b.patient.chilled && b.patient.attachedCount < 2 && b.patient.zone() === 'red')) {
      return void this.jobs.push({ to: at('jar'), verb: 'takeLeech' });
    }
    this.wait = 0.5 + Math.random();
  }

  private step() {
    const w = this.ward;
    if (!w || w.over) return;
    const d = w.doctors[this.me];
    if (d.dazed > 0) return;
    if (this.wait > 0) return void (this.wait -= STEP);
    if (!this.jobs.length) {
      this.plan();
      const spot = this.jobs[0]?.to();
      if (!spot) return void (this.jobs = []);
      this.route(spot);
      return;
    }
    if (!this.walk()) return;
    const job = this.jobs.shift()!;
    const spot = job.to();
    if (spot) d.facing = spot.facing;
    this.send({ t: 'move', x: d.x, y: d.y, run: false, facing: d.facing, flip: d.flip, ix: 0, iy: 0 });
    const tg = w.target(this.me);
    const verbs = Array.isArray(job.verb) ? job.verb : [job.verb];
    if (tg?.check.ok && verbs.includes(tg.check.verb)) this.send({ t: 'press' });
    this.wait = 0.35 + Math.random() * 0.4; // think
  }
}

async function main() {
  const [where = 'match', count = '1'] = process.argv.slice(2);
  const n = Math.max(1, Math.min(CONFIG.multi.maxPlayers, Number(count) || 1));
  for (let i = 0; i < n; i++) {
    let code = where.toUpperCase();
    if (where === 'match') {
      const r = await fetch(`${SERVER}/api/match`, { method: 'POST' });
      code = ((await r.json()) as { code: string }).code;
    }
    console.log(`Bot ${i + 1} → room ${code}`);
    new BotDoctor(`Bot ${i + 1}`, code);
    await new Promise((r) => setTimeout(r, 300));
  }
}

main();
if (process.env.BOT_SECONDS) setTimeout(() => process.exit(0), Number(process.env.BOT_SECONDS) * 1000);
