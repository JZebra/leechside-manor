// The whole ward as pure state: the doctors, what each carries, the beds and the
// queue, leeches on the floor, the salt bucket, the jar, the orderlies and the clock.
// The Phaser scene feeds it input and draws it; tests, bots and the multiplayer server
// drive it directly. One doctor alone, or up to four sharing the Grande Salle.

import { CONFIG, type PatientType, type StageId, type WardId } from '../config';
import { Patient, type FaintCause, type Profile } from './patient';
import { Shift } from './shift';
import { Supply } from './supply';
import { makeRng, type Rng } from './rng';
import {
  LAYOUTS, BED, bedRectOf, obstaclesOf, distToRect, nearestOn, overlaps,
  type Layout, type Point, type Rect, type StationId,
} from './layout';
import type { Fail, Verb } from '../data/lines';

export type Hand =
  | null
  | { kind: 'leech'; count: number } // a handful of hungry leeches
  | { kind: 'used'; count: number } // fed ones, for the salt
  | { kind: 'bandage' }
  | { kind: 'bottle' } // a stoneware hot-water bottle, filled at the stove
  | { kind: 'bdello' }
  | { kind: 'stretcher'; patient: Patient };

export type Target =
  | { kind: 'bed'; bed: number }
  | { kind: 'station'; id: StationId }
  | { kind: 'used'; id: number }
  | { kind: 'escapee'; id: number };

export type Check = { ok: true; verb: Verb } | { ok: false; fail: Fail };

export interface Bed {
  index: number;
  patient: Patient | null;
  bites: number[]; // slots of bites still bleeding (for drawing)
  freeIn: number; // orderly turnaround before the next man
  leaving: number; // seconds left on a treated man walking out
}

export interface Queued {
  id: number;
  type: PatientType;
  profile: Profile;
  cold: boolean;
  left: number; // queue patience
}

export interface FloorLeech { id: number; x: number; y: number; angle: number }
export interface Escapee { id: number; x: number; y: number; angle: number; bed: number | null; t: number }
export interface Salting { left: number; count: number }
export interface Orderly {
  id: number;
  x: number;
  y: number;
  route: Point[];
  leg: number; // index of the point he is walking towards
  waited: number; // seconds held up by a doctor
  facing: 'side' | 'up' | 'down';
  flip: boolean;
  moving: boolean;
  load: number; // what he carries (drawing only)
}

export type Facing = 'down' | 'up' | 'side';

// What the report credits to each doctor.
export interface DoctorStats {
  green: number; // men bandaged in the green
  faints: number; // men who fainted after he last bled them
  applied: number; // leeches he set on
  squashed: number; // fed leeches he slipped on
  knocked: number; // colleagues he ran into
  carried: number; // fainted men he carried out
}

export interface Doctor {
  id: number; // 0–3: his coat colour, his place in the report
  x: number;
  y: number;
  facing: Facing;
  flip: boolean;
  moving: boolean;
  running: boolean;
  dazed: number; // seconds left on the floor
  hand: Hand;
  pumping: number | null; // the bed he is pumping this frame (set by pump(), kept until the next tick)
  pumped: number | null; // …and the one he pumped last frame, for drawing
  stats: DoctorStats;
}

export type WardEvent =
  | { kind: 'stage'; id: StageId }
  | { kind: 'bell' }
  | { kind: 'arrive'; bed: number }
  | { kind: 'gaveUp'; bed: number | null; fee: number }
  | { kind: 'take'; what: string; who: number }
  | { kind: 'putBack'; what: string; who: number }
  | { kind: 'attach'; bed: number; slot: number; wild: boolean; who: number | null }
  | { kind: 'fail'; fail: Fail; target: Target | null; who: number }
  | { kind: 'warm'; bed: number; who: number }
  | { kind: 'leechDone'; bed: number; slot: number }
  | { kind: 'ready'; bed: number }
  | { kind: 'warning'; bed: number }
  | { kind: 'faint'; bed: number; cause: FaintCause; fee: number }
  | { kind: 'bandage'; bed: number; outcome: 'green' | 'early' | 'late'; fee: number; who: number }
  | { kind: 'lift'; bed: number; who: number }
  | { kind: 'deliver'; who: number }
  | { kind: 'scoop'; count: number; who: number }
  | { kind: 'salt'; count: number; who: number }
  | { kind: 'recycled'; count: number }
  | { kind: 'escape'; id: number }
  | { kind: 'latch'; bed: number }
  | { kind: 'drain'; fee: number }
  | { kind: 'catch'; who: number }
  | { kind: 'delivery'; count: number }
  | { kind: 'deviceArrives' }
  | { kind: 'stoveArrives' }
  | { kind: 'slip'; fee: number; spilled: number; who: number }
  | { kind: 'jostle'; x: number; y: number }
  | { kind: 'collide'; x: number; y: number; who: number } // ran into an orderly
  | { kind: 'knock'; x: number; y: number; who: number; other: number }; // ran into a colleague

export interface WardOptions {
  doctors?: number; // 1–4
  ward?: WardId; // the floor plan, if not the day's own
}

// A doctor's (and an orderly's) feet, for collisions.
const footOf = (x: number, y: number): Rect => ({ x: x - 4, y: y - 3, w: 8, h: 3 });
// An orderly with his basket takes up more of the aisle.
const bulkOf = (o: { x: number; y: number }): Rect => ({ x: o.x - 8, y: o.y - 6, w: 16, h: 7 });

type Hit = { orderly: Orderly } | { doctor: Doctor };

export class Ward {
  readonly shift: Shift;
  readonly layout: Layout;
  readonly supply: Supply;
  readonly beds: Bed[];
  readonly doctors: Doctor[];
  readonly queue: Queued[] = [];
  readonly floor: FloorLeech[] = [];
  readonly escapees: Escapee[] = [];
  readonly salting: Salting[] = [];
  readonly orderlies: Orderly[] = [];
  deviceOnStand = false; // the bdellometer arrives with a 'machine' stage
  stoveIn = false; // the stove (for hot-water bottles) arrives with a 'stove' stage
  applied = 0; // leeches set on patients, for Broussais's arithmetic
  lost = 0; // leeches down the drain or squashed
  slips = 0;
  floorAtBell = 0;
  private nextId = 1;
  private escapeIn: number = CONFIG.leech.escape.every;
  private orderlyIn = 3;
  private nextRoute = 0;
  private readonly underfoot: Set<number>[]; // per doctor: floor leeches he is standing on (one roll each)
  private readonly rng: Rng;
  private readonly walls: Rect[];

  constructor(seed: string, day = 0, opts: WardOptions = {}) {
    const n = Math.max(1, Math.min(CONFIG.multi.maxPlayers, opts.doctors ?? 1));
    const scale = (k: readonly number[]) => k[n - 1];
    this.shift = new Shift(seed, day, scale(CONFIG.multi.rate));
    const spec = this.shift.spec;
    this.layout = LAYOUTS[opts.ward ?? spec.ward];
    const j = scale(CONFIG.multi.jar);
    const schedule = spec.deliveries && { every: spec.deliveries.every, size: Math.round(spec.deliveries.size * j) };
    this.supply = new Supply(Math.round(spec.jar * j), schedule, Math.round(CONFIG.supply.cap * j));
    this.rng = makeRng(seed, 'ward', day);
    // the stove isn't in the ward until a 'stove' stage brings it: it blocks the way only then
    const stoveFoot = this.layout.stations.stove.foot;
    this.walls = obstaclesOf(this.layout).filter((r) => r !== stoveFoot);
    this.beds = this.layout.beds.map((_, index) => ({ index, patient: null, bites: [], freeIn: 0, leaving: 0 }));
    this.doctors = Array.from({ length: n }, (_, id) => {
      const s = this.layout.starts[id];
      return {
        id, x: s.x, y: s.y, facing: 'down' as Facing, flip: false, moving: false, running: false, dazed: 0,
        hand: null, pumping: null, pumped: null,
        stats: { green: 0, faints: 0, applied: 0, squashed: 0, knocked: 0, carried: 0 },
      };
    });
    this.underfoot = this.doctors.map(() => new Set<number>());
  }

  // The first doctor: the only one when playing alone.
  get doctor(): Doctor {
    return this.doctors[0];
  }

  get hand(): Hand {
    return this.doctors[0].hand;
  }

  set hand(h: Hand) {
    this.doctors[0].hand = h;
  }

  get over() {
    return this.shift.over;
  }

  get day() {
    return this.shift.spec;
  }

  bedRect(i: number): Rect {
    return bedRectOf(this.layout, i);
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  // run: Shift held. Faster, but no care for what's underfoot or who's in the way.
  walk(ix: number, iy: number, dt: number, run = false, who = 0): WardEvent[] {
    const d = this.doctors[who];
    const len = Math.hypot(ix, iy);
    d.moving = len > 0 && d.dazed <= 0;
    d.running = d.moving && run;
    if (!d.moving) return [];
    this.face(d, ix, iy);
    const speed = CONFIG.doctor.speed * (d.hand?.kind === 'stretcher' ? CONFIG.doctor.carrying : 1) * (run ? CONFIG.run.speed : 1);
    const step = (speed * dt) / len;
    return this.stepBy(d, ix * step, iy * step, run);
  }

  // Move a doctor to where his player's own screen has him (playing online: each player
  // moves his doctor at once, and the server follows). The same walls, colleagues and
  // leeches underfoot apply, so the server decides any slip or collision.
  // (ix, iy) is the way he's pushing: his own screen stops him at a colleague's shoulder,
  // so a run that ends there still knocks them both down.
  walkTo(who: number, x: number, y: number, run: boolean, facing: Facing, flip: boolean, ix = 0, iy = 0): WardEvent[] {
    const d = this.doctors[who];
    if (d.dazed > 0) {
      d.moving = d.running = false;
      return [];
    }
    d.facing = facing;
    d.flip = flip;
    const dx = x - d.x;
    const dy = y - d.y;
    const pushing = ix !== 0 || iy !== 0;
    d.moving = pushing || Math.hypot(dx, dy) > 0.01;
    d.running = d.moving && run;
    if (!d.moving) return [];
    const events = this.stepBy(d, dx, dy, run);
    if (events.length || !run || !pushing) return events;
    const hit = this.blocked(footOf(d.x + Math.sign(ix) * 1.5, d.y + Math.sign(iy) * 1.5), d);
    if (hit && hit !== 'wall') return 'orderly' in hit ? this.collide(d, hit.orderly) : this.knock(d, hit.doctor);
    return events;
  }

  // Move a doctor on his own player's screen, ahead of the server: walls and colleagues
  // stop him, but slips and collisions are the server's to decide (walkTo).
  glide(ix: number, iy: number, dt: number, run: boolean, who: number) {
    const d = this.doctors[who];
    const len = Math.hypot(ix, iy);
    d.moving = len > 0 && d.dazed <= 0;
    d.running = d.moving && run;
    if (!d.moving) return;
    this.face(d, ix, iy);
    const speed = CONFIG.doctor.speed * (d.hand?.kind === 'stretcher' ? CONFIG.doctor.carrying : 1) * (run ? CONFIG.run.speed : 1);
    const step = (speed * dt) / len;
    if (!this.moveAxis(d, ix * step, 0)) this.moveAxis(d, 0, iy * step);
  }

  private face(d: Doctor, ix: number, iy: number) {
    if (Math.abs(ix) > Math.abs(iy)) {
      d.facing = 'side';
      d.flip = ix < 0;
    } else d.facing = iy < 0 ? 'up' : 'down';
  }

  private stepBy(d: Doctor, dx: number, dy: number, run: boolean): WardEvent[] {
    const hit = this.moveAxis(d, dx, 0) ?? this.moveAxis(d, 0, dy);
    if (hit && run) return 'orderly' in hit ? this.collide(d, hit.orderly) : this.knock(d, hit.doctor);
    return this.checkFooting(run, d.id);
  }

  private blocked(r: Rect, self: Doctor): Hit | 'wall' | null {
    const stove = this.stoveIn ? this.layout.stations.stove.foot : null;
    if (this.walls.some((o) => overlaps(r, o)) || (!!stove && overlaps(r, stove))) return 'wall';
    const orderly = this.orderlies.find((o) => overlaps(r, bulkOf(o)));
    if (orderly) return { orderly };
    const doctor = this.doctors.find((o) => o !== self && overlaps(r, footOf(o.x, o.y)));
    return doctor ? { doctor } : null;
  }

  // Move along one axis if the way is clear. Returns the orderly or colleague in the way,
  // if that's what stopped him.
  private moveAxis(d: Doctor, dx: number, dy: number): Hit | null {
    const w = this.layout.walk;
    const nx = Math.min(w.x1, Math.max(w.x0, d.x + dx));
    const ny = Math.min(w.y1, Math.max(w.y0, d.y + dy));
    const hit = this.blocked(footOf(nx, ny), d);
    if (!hit) {
      d.x = nx;
      d.y = ny;
      return null;
    }
    return hit === 'wall' ? null : hit;
  }

  private fall(d: Doctor, seconds: number) {
    d.dazed = Math.max(d.dazed, seconds);
    d.moving = false;
    d.running = false;
    d.pumping = null;
  }

  // Running full tilt into an orderly: down he goes.
  private collide(d: Doctor, o: Orderly): WardEvent[] {
    this.fall(d, CONFIG.run.stunned);
    return [{ kind: 'collide', x: (d.x + o.x) / 2, y: Math.min(d.y, o.y) - 26, who: d.id }];
  }

  // …or into a colleague: down they both go, the one who ran the longer.
  private knock(d: Doctor, other: Doctor): WardEvent[] {
    this.fall(d, CONFIG.run.stunned);
    this.fall(other, CONFIG.multi.knocked);
    d.stats.knocked++;
    return [{ kind: 'knock', x: (d.x + other.x) / 2, y: Math.min(d.y, other.y) - 26, who: d.id, other: other.id }];
  }

  // Fed leeches on the floor are slippery — but only at a run: walking, he picks his way
  // round them; running, every one he steps on (as he steps on it) sends him flying.
  // (Public so the balance sim, which moves the doctor itself, can trip him too.)
  checkFooting(run = false, who = 0): WardEvent[] {
    const d = this.doctors[who];
    const underfoot = this.underfoot[who];
    const r = CONFIG.slip.radius;
    const near = new Set(this.floor.filter((f) => Math.hypot(f.x - d.x, f.y - d.y) <= r).map((f) => f.id));
    for (const id of [...underfoot]) if (!near.has(id)) underfoot.delete(id);
    for (const id of near) {
      if (underfoot.has(id)) continue;
      underfoot.add(id);
      if (run && this.rng.chance(CONFIG.run.slipChance)) return this.slip(d, id);
    }
    return [];
  }

  private slip(d: Doctor, id: number): WardEvent[] {
    this.fall(d, CONFIG.slip.dazed);
    this.slips++;
    d.stats.squashed++;
    // the leech underfoot is squashed
    this.floor.splice(this.floor.findIndex((f) => f.id === id), 1);
    for (const u of this.underfoot) u.delete(id);
    this.lost++;
    this.shift.fine(CONFIG.score.leechLost);
    // and whatever leeches he held go flying
    let spilled = 0;
    const hand = d.hand;
    if (hand?.kind === 'leech') {
      for (let i = 0; i < hand.count; i++) {
        const a = this.rng.next() * Math.PI * 2;
        this.escapees.push({ id: this.nextId++, x: d.x + Math.cos(a) * 10, y: d.y + Math.sin(a) * 6, angle: a, bed: null, t: this.rng.next() * 6 });
      }
      spilled = hand.count;
      d.hand = null;
    } else if (hand?.kind === 'used') {
      for (let i = 0; i < hand.count; i++) this.dropAt(d.x + (this.rng.next() - 0.5) * 22, d.y + (this.rng.next() - 0.5) * 10);
      spilled = hand.count;
      d.hand = null;
    }
    return [{ kind: 'slip', fee: CONFIG.score.leechLost, spilled, who: d.id }];
  }

  // ── Targeting ─────────────────────────────────────────────────────────────

  private facingVec(d: Doctor): Point {
    return d.facing === 'side' ? { x: d.flip ? -1 : 1, y: 0 } : { x: 0, y: d.facing === 'up' ? -1 : 1 };
  }

  // Everything within reach, with the nearest point of each (for "is it in front of him?").
  private inReach(d: Doctor): { target: Target; dist: number; at: Point }[] {
    const { x, y } = d;
    const out: { target: Target; dist: number; at: Point }[] = [];
    const reach = CONFIG.doctor.reach;
    this.beds.forEach((b, i) => {
      if (!b.patient || b.leaving > 0) return;
      const r = this.bedRect(i);
      const dist = distToRect(x, y, r);
      if (dist <= reach) out.push({ target: { kind: 'bed', bed: i }, dist, at: nearestOn(x, y, r) });
    });
    for (const id of Object.keys(this.layout.stations) as StationId[]) {
      if (id === 'stove' && !this.stoveIn) continue;
      const r = this.layout.stations[id].use;
      const dist = distToRect(x, y, r);
      if (dist <= reach) out.push({ target: { kind: 'station', id }, dist, at: nearestOn(x, y, r) });
    }
    const pick = CONFIG.doctor.pickReach;
    for (const f of this.floor) {
      const dist = Math.hypot(f.x - x, f.y - y);
      if (dist <= pick) out.push({ target: { kind: 'used', id: f.id }, dist, at: f });
    }
    for (const e of this.escapees) {
      const dist = Math.hypot(e.x - x, e.y - y);
      if (dist <= pick) out.push({ target: { kind: 'escapee', id: e.id }, dist, at: e });
    }
    return out;
  }

  // The best target: what he faces and is nearest, among things that can be done now;
  // failing that, the nearest refusal (so a press can say why). A runaway leech and a
  // patient's need edge out the furniture.
  target(who = 0): { target: Target; check: Check } | null {
    const d = this.doctors[who];
    if (d.dazed > 0) return null;
    const f = this.facingVec(d);
    const { x, y } = d;
    let best: { target: Target; check: Check; score: number } | null = null;
    let refusal: { target: Target; check: Check; dist: number } | null = null;
    for (const { target, dist, at } of this.inReach(d)) {
      const check = this.check(target, who);
      if (!check.ok) {
        if (check.fail !== 'nothing' && (!refusal || dist < refusal.dist)) refusal = { target, check, dist };
        continue;
      }
      const vx = at.x - x;
      const vy = at.y - (y - 4);
      const vl = Math.hypot(vx, vy);
      const ahead = vl < 2 || (vx * f.x + vy * f.y) / vl > 0.45;
      let score = dist - (ahead ? 6 : 0);
      if (check.verb === 'catch') score -= 6;
      if (target.kind === 'bed') score -= 3;
      if (!best || score < best.score) best = { target, check, score };
    }
    if (best) return { target: best.target, check: best.check };
    return refusal ? { target: refusal.target, check: refusal.check } : null;
  }

  check(t: Target, who = 0): Check {
    const hand = this.doctors[who].hand;
    const ok = (verb: Verb): Check => ({ ok: true, verb });
    const no = (fail: Fail): Check => ({ ok: false, fail });
    const handful = CONFIG.doctor.handful;

    if (t.kind === 'used') {
      if (!this.floor.some((f) => f.id === t.id)) return no('nothing'); // gone: scooped, or squashed
      if (!hand) return ok('scoop');
      if (hand.kind === 'used') return hand.count < CONFIG.doctor.scoop ? ok('scoop') : no('scoopFull');
      return no('handsFull');
    }
    if (t.kind === 'escapee') {
      if (!this.escapees.some((e) => e.id === t.id)) return no('nothing'); // gone: caught, or down the drain
      if (!hand) return ok('catch');
      if (hand.kind !== 'leech') return no('handsFull');
      return hand.count < handful ? ok('catch') : no('handful');
    }

    if (t.kind === 'station') {
      switch (t.id) {
        case 'jar':
          if (hand?.kind === 'leech') {
            // a full hand (or an empty jar) pours back; otherwise take another
            if (hand.count >= handful || this.supply.jar <= 0) return ok('putBackAll');
            return ok('takeLeech');
          }
          if (hand) return no('handsFull');
          if (this.supply.jar <= 0) return no(this.supply.deliveries ? 'jarEmpty' : 'jarShortage');
          return ok('takeLeech');
        case 'cupboard':
          if (hand?.kind === 'bandage') return ok('putBack');
          return hand ? no('handsFull') : ok('takeBandage');
        case 'stove':
          if (hand?.kind === 'bottle') return ok('putBack');
          return hand ? no('handsFull') : ok('takeBottle');
        case 'bucket':
          if (hand?.kind === 'used') return ok('salt');
          if (hand?.kind === 'leech') return no('saltHungry');
          return hand ? no('handsFull') : no('nothing');
        case 'stand':
          if (hand?.kind === 'bdello') return ok('putBack');
          if (!this.deviceOnStand) {
            if (hand) return no('nothing');
            return no(this.doctors.some((o) => o.hand?.kind === 'bdello') ? 'deviceBusy' : 'stand');
          }
          return hand ? no('handsFull') : ok('takeDevice');
        case 'door':
          return hand?.kind === 'stretcher' ? ok('deliver') : no('door');
      }
    }

    // a bed
    const p = this.beds[t.bed].patient;
    if (!p) return no('nothing');
    if (p.state === 'fainted') return hand ? no('notDone') : ok('lift');
    if (!p.active) return no('nothing');
    if (!hand) return no('nothing');
    switch (hand.kind) {
      case 'leech':
        if (p.chilled) return no('cold');
        if (p.attachedCount >= CONFIG.patient.maxLeeches) return no('full');
        return ok('apply');
      case 'bandage':
        return ok('bandage');
      case 'bottle':
        return p.chilled ? ok('warm') : no('notCold');
      case 'bdello':
        return ok('pump');
      case 'used':
        return no('usedOnPatient');
      case 'stretcher':
        return no('handsFull');
    }
  }

  // ── Acting ────────────────────────────────────────────────────────────────

  // One press of E on a target (pumping is pump(), called while E is held).
  interact(t: Target, who = 0): WardEvent[] {
    const check = this.check(t, who);
    if (!check.ok) return [{ kind: 'fail', fail: check.fail, target: t, who }];
    const d = this.doctors[who];
    const out: WardEvent[] = [];
    const hand = d.hand;
    switch (check.verb) {
      case 'takeLeech':
        this.supply.take();
        if (hand?.kind === 'leech') hand.count++;
        else d.hand = { kind: 'leech', count: 1 };
        out.push({ kind: 'take', what: 'leech', who });
        break;
      case 'putBackAll':
      case 'putBack':
        if (hand?.kind === 'leech') this.supply.give(hand.count);
        if (hand?.kind === 'bdello') this.deviceOnStand = true;
        out.push({ kind: 'putBack', what: hand!.kind, who });
        d.hand = null;
        break;
      case 'takeBandage':
        d.hand = { kind: 'bandage' };
        out.push({ kind: 'take', what: 'bandage', who });
        break;
      case 'takeBottle':
        d.hand = { kind: 'bottle' };
        out.push({ kind: 'take', what: 'bottle', who });
        break;
      case 'takeDevice':
        this.deviceOnStand = false;
        d.hand = { kind: 'bdello' };
        out.push({ kind: 'take', what: 'bdello', who });
        break;
      case 'salt': {
        const count = (hand as { count: number }).count;
        this.salting.push({ left: CONFIG.leech.recycleSeconds, count });
        d.hand = null;
        out.push({ kind: 'salt', count, who });
        break;
      }
      case 'scoop': {
        // a handful: every fed leech within reach, up to what one hand holds
        const { x, y } = d;
        let count = hand?.kind === 'used' ? hand.count : 0;
        const first = this.floor.findIndex((f) => t.kind === 'used' && f.id === t.id);
        const order = [first, ...this.floor.map((_, i) => i).filter((i) => i !== first)];
        const taken = new Set<number>();
        for (const i of order) {
          if (count >= CONFIG.doctor.scoop) break;
          const f = this.floor[i];
          if (i === first || Math.hypot(f.x - x, f.y - y) <= CONFIG.doctor.pickReach + 6) {
            taken.add(f.id);
            count++;
          }
        }
        for (let i = this.floor.length - 1; i >= 0; i--) if (taken.has(this.floor[i].id)) this.floor.splice(i, 1);
        d.hand = { kind: 'used', count };
        out.push({ kind: 'scoop', count: taken.size, who });
        break;
      }
      case 'catch': {
        const i = this.escapees.findIndex((e) => t.kind === 'escapee' && e.id === t.id);
        this.escapees.splice(i, 1);
        if (hand?.kind === 'leech') hand.count++;
        else d.hand = { kind: 'leech', count: 1 };
        out.push({ kind: 'catch', who });
        break;
      }
      case 'deliver':
        d.hand = null;
        d.stats.carried++;
        out.push({ kind: 'deliver', who });
        break;
      case 'lift': {
        const bed = this.beds[(t as { bed: number }).bed];
        d.hand = { kind: 'stretcher', patient: bed.patient! };
        bed.patient = null;
        bed.bites = [];
        bed.freeIn = CONFIG.patient.turnaround;
        out.push({ kind: 'lift', bed: bed.index, who });
        break;
      }
      case 'apply': {
        const bed = this.beds[(t as { bed: number }).bed];
        const p = bed.patient!;
        const slot = p.leeches.indexOf(null);
        p.attach();
        p.by = who;
        const h = hand as { count: number };
        h.count--;
        if (h.count <= 0) d.hand = null;
        this.applied++;
        d.stats.applied++;
        out.push({ kind: 'attach', bed: bed.index, slot, wild: false, who });
        break;
      }
      case 'warm': {
        const bed = this.beds[(t as { bed: number }).bed];
        bed.patient!.warm();
        d.hand = null;
        out.push({ kind: 'warm', bed: bed.index, who });
        break;
      }
      case 'bandage': {
        const bed = this.beds[(t as { bed: number }).bed];
        const p = bed.patient!;
        const r = p.bandage()!;
        this.dropLeeches(bed.index, r.dropped);
        d.hand = null;
        bed.bites = [];
        bed.leaving = 1.2;
        if (r.outcome === 'green') d.stats.green++;
        this.shift.record({ profile: p.profile, type: p.type, outcome: r.outcome, fee: r.fee });
        out.push({ kind: 'bandage', bed: bed.index, outcome: r.outcome, fee: r.fee, who });
        break;
      }
      case 'pump':
        break; // handled by pump()
    }
    return out;
  }

  // Called each frame while E is held with the bdellometer on a bed.
  pump(bed: number, dt: number, who = 0): WardEvent[] {
    const d = this.doctors[who];
    const p = this.beds[bed].patient;
    if (d.hand?.kind !== 'bdello' || !p?.active || d.dazed > 0) return [];
    d.pumping = bed;
    p.by = who;
    return this.patientEvents(bed, p.pump(dt));
  }

  // ── Time ──────────────────────────────────────────────────────────────────

  tick(dt: number): WardEvent[] {
    if (this.over) return [];
    const out: WardEvent[] = [];
    const push = (e: WardEvent | WardEvent[]) => (Array.isArray(e) ? out.push(...e) : out.push(e));

    for (const d of this.doctors) {
      if (d.dazed > 0) d.dazed = Math.max(0, d.dazed - dt);
      d.pumped = d.pumping;
      d.pumping = null;
    }

    for (const e of this.shift.tick(dt)) {
      if (e.kind === 'stage') {
        push(e);
        push(this.stageArrivals());
      } else if (e.kind === 'arrival') {
        this.queue.push({ id: this.nextId++, type: e.type, profile: e.profile, cold: e.cold, left: CONFIG.patient.queuePatience });
      } else if (e.kind === 'bell') {
        this.closeShift();
        push(e);
        return out;
      }
    }
    push(this.supply.tick(dt));

    // the orderly brings the next man to a free bed
    for (const b of this.beds) {
      if (b.leaving > 0) {
        b.leaving -= dt;
        if (b.leaving <= 0) {
          b.patient = null;
          b.freeIn = CONFIG.patient.turnaround;
        }
      } else if (!b.patient) b.freeIn -= dt;
    }
    for (const b of this.beds) {
      if (!b.patient && b.freeIn <= 0 && this.queue.length) {
        const q = this.queue.shift()!;
        b.patient = new Patient(q.type, q.profile, q.cold, q.id);
        b.bites = [];
        push({ kind: 'arrive', bed: b.index });
      }
    }
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.left -= dt;
      if (q.left <= 0) {
        this.queue.splice(i, 1);
        this.shift.record({ profile: q.profile, type: q.type, outcome: 'walkedOut', fee: CONFIG.score.walkedOut });
        push({ kind: 'gaveUp', bed: null, fee: CONFIG.score.walkedOut });
      }
    }

    // patients bleed, leeches feed (a doctor at the bedside calms a nervous man)
    for (const b of this.beds) {
      const p = b.patient;
      if (!p || b.leaving > 0) continue;
      const near = this.anyDoctorWithin(this.bedRect(b.index), CONFIG.doctor.calmRange);
      push(this.patientEvents(b.index, p.tick(dt, near)));
    }

    push(this.tickEscapes(dt));
    push(this.tickOrderlies(dt));

    for (let i = this.salting.length - 1; i >= 0; i--) {
      const s = this.salting[i];
      s.left -= dt;
      if (s.left <= 0) {
        this.salting.splice(i, 1);
        this.supply.give(s.count);
        push({ kind: 'recycled', count: s.count });
      }
    }
    return out;
  }

  private anyDoctorWithin(r: Rect, range: number): boolean {
    return this.doctors.some((d) => distToRect(d.x, d.y, r) <= range);
  }

  // What a new stage brings into the ward. Things that arrive mid-day are announced; on a
  // day that starts with them, they're simply there.
  private stageArrivals(): WardEvent[] {
    const out: WardEvent[] = [];
    const spec = CONFIG.stages[this.shift.stage];
    const midday = this.shift.stageIndex > 0;
    if (spec.machine && !this.deviceOnStand && !this.doctors.some((d) => d.hand?.kind === 'bdello')) {
      this.deviceOnStand = true;
      if (midday) out.push({ kind: 'deviceArrives' });
    }
    if (spec.stove && !this.stoveIn) {
      this.stoveIn = true;
      this.clearOf(this.layout.stations.stove.foot!);
      if (midday) out.push({ kind: 'stoveArrives' });
    }
    return out;
  }

  // If something is set down where a doctor stands, he steps out of its way.
  private clearOf(r: Rect) {
    for (const d of this.doctors) if (overlaps(footOf(d.x, d.y), r)) d.y = Math.min(this.layout.walk.y1, r.y + r.h + 3);
  }

  private patientEvents(bed: number, events: ReturnType<Patient['tick']>): WardEvent[] {
    const b = this.beds[bed];
    const p = b.patient!;
    const out: WardEvent[] = [];
    for (const e of events) {
      switch (e.kind) {
        case 'leechDone':
          b.bites.push(e.slot);
          this.dropLeeches(bed, 1);
          out.push({ kind: 'leechDone', bed, slot: e.slot });
          break;
        case 'ready':
        case 'warning':
          out.push({ kind: e.kind, bed });
          break;
        case 'faint':
          this.dropLeeches(bed, e.dropped);
          b.bites = [];
          if (p.by != null) this.doctors[p.by].stats.faints++;
          this.shift.record({ profile: p.profile, type: p.type, outcome: 'faint', fee: CONFIG.score.faint });
          out.push({ kind: 'faint', bed, cause: e.cause, fee: CONFIG.score.faint });
          break;
        case 'walkedOut':
          b.leaving = 1.2;
          this.shift.record({ profile: p.profile, type: p.type, outcome: 'walkedOut', fee: CONFIG.score.walkedOut });
          out.push({ kind: 'gaveUp', bed, fee: CONFIG.score.walkedOut });
          break;
      }
    }
    return out;
  }

  private dropAt(x: number, y: number) {
    const w = this.layout.walk;
    const f = {
      id: this.nextId++,
      x: Math.min(w.x1, Math.max(w.x0, x)),
      y: Math.min(w.y1, Math.max(w.y0, y)),
      angle: this.rng.next() * Math.PI * 2,
    };
    this.floor.push(f);
    // one landing under a doctor's feet doesn't trip him as he steps off it
    this.doctors.forEach((d, i) => {
      if (Math.hypot(f.x - d.x, f.y - d.y) <= CONFIG.slip.radius) this.underfoot[i].add(f.id);
    });
  }

  // Fed leeches drop off the bed onto the floor beside it — where people walk, not
  // where the doctor stands to treat the man.
  private dropLeeches(bed: number, n: number) {
    const r = this.bedRect(bed);
    for (let i = 0; i < n; i++) {
      const right = this.rng.chance(0.5);
      const x = right ? r.x + r.w + 2 + this.rng.next() * 5 : r.x - 2 - this.rng.next() * 5;
      this.dropAt(x, r.y + r.h - 8 + this.rng.next() * 14);
    }
  }

  private tickEscapes(dt: number): WardEvent[] {
    const out: WardEvent[] = [];
    const esc = CONFIG.leech.escape;
    const rim = this.layout.jarRim;
    if (this.day.escapes) {
      this.escapeIn -= dt;
      if (this.escapeIn <= 0) {
        this.escapeIn = esc.every;
        if (this.supply.jar >= esc.minJar && this.rng.chance(esc.chance)) {
          this.supply.jar--;
          const seek = this.rng.chance(esc.seekPatient);
          const id = this.nextId++;
          this.escapees.push({ id, x: rim.x, y: rim.y, angle: 0, bed: seek ? this.nearestOpenBed(rim.x, rim.y) : null, t: this.rng.next() * 6 });
          out.push({ kind: 'escape', id });
        }
      }
    }
    const drain = this.layout.drain;
    for (let i = this.escapees.length - 1; i >= 0; i--) {
      const e = this.escapees[i];
      e.t += dt;
      const p = e.bed != null ? this.beds[e.bed].patient : null;
      if (e.bed != null && (!p?.active || p.chilled || p.attachedCount >= CONFIG.patient.maxLeeches)) e.bed = null;
      const goal = e.bed != null ? { x: this.layout.beds[e.bed].x + BED.w / 2, y: this.layout.beds[e.bed].y + BED.h } : drain;
      const dx = goal.x - e.x;
      const dy = goal.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (e.bed != null && distToRect(e.x, e.y, this.bedRect(e.bed)) <= esc.latchRange) {
        if (!this.anyDoctorWithin(this.bedRect(e.bed), CONFIG.doctor.reach)) {
          const bed = e.bed;
          const slot = this.beds[bed].patient!.leeches.indexOf(null);
          this.beds[bed].patient!.attach(true);
          this.escapees.splice(i, 1);
          out.push({ kind: 'latch', bed }, { kind: 'attach', bed, slot, wild: true, who: null });
          continue;
        }
        e.bed = null; // shooed off: make for the drain
        continue;
      }
      if (e.bed == null && dist < 3) {
        this.escapees.splice(i, 1);
        this.lost++;
        this.shift.fine(CONFIG.score.leechLost);
        out.push({ kind: 'drain', fee: CONFIG.score.leechLost });
        continue;
      }
      // an inchworm's crawl: reach, grip, pull up
      const heading = Math.atan2(dy, dx) + Math.sin(e.t * 2.2) * 0.6;
      const speed = esc.crawlSpeed * (0.3 + 0.7 * Math.max(0, Math.sin(e.t * 4)));
      e.x += Math.cos(heading) * speed * dt;
      e.y += Math.sin(heading) * speed * dt;
      e.angle = heading + Math.PI / 2; // sprites point up at angle 0
    }
    return out;
  }

  // Orderlies cross the ward on their rounds. They won't walk through a doctor:
  // they wait a moment, then squeeze past.
  private tickOrderlies(dt: number): WardEvent[] {
    const out: WardEvent[] = [];
    const routes = this.layout.routes;
    if (this.day.orderlies && routes.length) {
      this.orderlyIn -= dt;
      if (this.orderlyIn <= 0) {
        this.orderlyIn = CONFIG.orderly.every;
        const route = routes[this.nextRoute++ % routes.length];
        this.orderlies.push({
          id: this.nextId++, x: route[0].x, y: route[0].y, route, leg: 1, waited: 0,
          facing: 'side', flip: route[1].x < route[0].x, moving: true, load: this.rng.int(0, 2),
        });
      }
    }
    const feet = this.doctors.map((d) => footOf(d.x, d.y));
    for (let i = this.orderlies.length - 1; i >= 0; i--) {
      const o = this.orderlies[i];
      const goal = o.route[o.leg];
      const dx = goal.x - o.x;
      const dy = goal.y - o.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, CONFIG.orderly.speed * dt);
      const nx = o.x + (dx / (dist || 1)) * step;
      const ny = o.y + (dy / (dist || 1)) * step;
      const bulk = bulkOf({ x: nx, y: ny });
      const bump = feet.some((f) => overlaps(bulk, f));
      if (bump && o.waited < CONFIG.orderly.patience) {
        if (o.waited === 0) out.push({ kind: 'jostle', x: o.x, y: o.y - 26 });
        o.waited += dt;
        o.moving = false;
        continue;
      }
      if (!bump) o.waited = 0;
      o.moving = true;
      o.x = nx;
      o.y = ny;
      if (Math.abs(dx) >= Math.abs(dy)) {
        o.facing = 'side';
        o.flip = dx < 0;
      } else o.facing = dy < 0 ? 'up' : 'down';
      if (dist - step < 0.5) {
        o.leg++;
        if (o.leg >= o.route.length) this.orderlies.splice(i, 1);
      }
    }
    return out;
  }

  private nearestOpenBed(x: number, y: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    this.beds.forEach((b, i) => {
      const p = b.patient;
      if (!p?.active || p.chilled || b.leaving > 0 || p.attachedCount >= CONFIG.patient.maxLeeches) return;
      const d = distToRect(x, y, this.bedRect(i));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  // Six o'clock: fine the mess on the floor; anyone still abed goes to the night shift.
  private closeShift() {
    const held = this.doctors.reduce((n, d) => n + (d.hand?.kind === 'used' ? d.hand.count : 0), 0);
    const floor = this.floor.length + this.escapees.length + held;
    if (floor) this.shift.fine(floor * CONFIG.score.floorLeech);
    this.floorAtBell = floor;
    for (const b of this.beds) {
      const p = b.patient;
      if (p && b.leaving <= 0 && p.active) this.shift.log.push({ profile: p.profile, type: p.type, outcome: 'unfinished', fee: 0 });
    }
    for (const d of this.doctors) if (d.hand?.kind === 'stretcher') d.hand = null;
  }

  // A doctor leaves the game (his player disconnected): whatever he held goes home.
  dropOut(who: number) {
    const d = this.doctors[who];
    const hand = d.hand;
    if (hand?.kind === 'leech') this.supply.give(hand.count);
    if (hand?.kind === 'bdello') this.deviceOnStand = true;
    if (hand?.kind === 'used') this.salting.push({ left: CONFIG.leech.recycleSeconds, count: hand.count });
    // a man on a stretcher is taken out by the orderlies
    d.hand = null;
    d.x = -100; // out of everyone's way
    d.y = -100;
    d.moving = d.running = false;
  }

  // Start the day at a later stage (testing): the clock jumps, earlier notes are skipped.
  skipTo(id: StageId): WardEvent[] {
    if (!this.shift.skipTo(id)) return [];
    const reached = this.day.stages.slice(0, this.shift.stageIndex + 1);
    if (reached.some((s) => CONFIG.stages[s.id].machine)) this.deviceOnStand = true;
    if (reached.some((s) => CONFIG.stages[s.id].stove) && !this.stoveIn) {
      this.stoveIn = true;
      this.clearOf(this.layout.stations.stove.foot!);
    }
    return [{ kind: 'stage', id }];
  }

  // For drawing: the stand shows the device when it's there.
  stationTex(id: StationId): string {
    if (id === 'stand') return this.deviceOnStand ? 'stand:full' : 'stand:empty';
    return this.layout.stations[id].tex;
  }
}
