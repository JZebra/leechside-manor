import { describe, it, expect } from 'vitest';
import { Ward, type Target } from '../src/model/ward';
import { CONFIG } from '../src/config';
import { BED, type StationId } from '../src/model/layout';

const DAY1 = 0;
const DAY2 = 1;
const DAY3 = 2;

const at = (w: Ward, x: number, y: number, facing: 'down' | 'up' | 'side' = 'up', flip = false) =>
  Object.assign(w.doctor, { x, y, facing, flip });
// stand at the foot of a bed (top row) or its head (bottom row), facing it
const byBed = (w: Ward, i: number) => {
  const b = w.layout.beds[i];
  return b.y < 100 ? at(w, b.x + BED.w / 2, b.y + BED.h + 11, 'up') : at(w, b.x + BED.w / 2, b.y - 2, 'down');
};
// stand in front of a station's base, facing it
const byStation = (w: Ward, id: StationId) => {
  const u = w.layout.stations[id].use;
  at(w, u.x + u.w / 2, u.y + u.h + 3, 'up');
};
function press(w: Ward) {
  const t = w.target();
  if (!t) throw new Error('nothing in reach');
  return w.interact(t.target);
}
// run the clock until bed i has a patient
function untilPatient(w: Ward, i = 0) {
  for (let n = 0; n < 400 && !w.beds[i].patient; n++) w.tick(0.1);
  expect(w.beds[i].patient).toBeTruthy();
  return w.beds[i].patient!;
}

describe('the ward', () => {
  it('the doctor cannot walk through a bed', () => {
    const w = new Ward('walls');
    byBed(w, 0);
    for (let i = 0; i < 60; i++) w.walk(0, -1, 0.05);
    expect(w.doctor.y).toBeGreaterThanOrEqual(w.layout.beds[0].y + BED.h);
  });

  it('two men come in at eight and take beds', () => {
    const w = new Ward('opening');
    for (let i = 0; i < 40; i++) w.tick(0.1);
    expect(w.beds.filter((b) => b.patient).length).toBe(2);
  });

  it('leech from the jar → patient → fed leech on the floor → salt → back in the jar', () => {
    const w = new Ward('loop');
    const p = untilPatient(w, 0);
    byStation(w, 'jar');
    const jar0 = w.supply.jar;
    press(w);
    expect(w.hand).toEqual({ kind: 'leech', count: 1 });
    expect(w.supply.jar).toBe(jar0 - 1);
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: true, verb: 'apply' });
    press(w);
    expect(p.attachedCount).toBe(1);
    expect(w.hand).toBeNull();
    for (let i = 0; i < CONFIG.leech.feedSeconds * 10 + 2; i++) w.tick(0.1);
    expect(p.attachedCount).toBe(0);
    expect(w.floor.length).toBe(1);
    const f = w.floor[0];
    at(w, f.x, f.y + 6, 'up');
    press(w);
    expect(w.hand).toEqual({ kind: 'used', count: 1 });
    byStation(w, 'bucket');
    press(w);
    expect(w.salting.length).toBe(1);
    const before = w.supply.jar;
    for (let i = 0; i < CONFIG.leech.recycleSeconds * 10 + 2; i++) w.tick(0.1);
    expect(w.supply.jar).toBeGreaterThan(before);
  });

  it('a handful: up to three from the jar, and a full hand pours back', () => {
    const w = new Ward('handful');
    byStation(w, 'jar');
    const jar = w.supply.jar;
    press(w);
    press(w);
    press(w);
    expect(w.hand).toEqual({ kind: 'leech', count: 3 });
    expect(w.target()?.check).toEqual({ ok: true, verb: 'putBackAll' });
    press(w);
    expect(w.hand).toBeNull();
    expect(w.supply.jar).toBe(jar);
  });

  it('a bandage in the green pays the full fee', () => {
    const w = new Ward('lint');
    const p = untilPatient(w, 0);
    p.blood = (p.spec.green[0] + p.spec.green[1]) / 2;
    p.state = 'treating';
    byStation(w, 'cupboard');
    press(w);
    byBed(w, 0);
    const ev = press(w);
    expect(ev).toContainEqual({ kind: 'bandage', bed: 0, outcome: 'green', fee: CONFIG.score.green });
    expect(w.shift.money).toBe(CONFIG.score.green);
  });

  it('a fainted man must be carried to the door, slowly', () => {
    const w = new Ward('faint');
    const p = untilPatient(w, 0);
    p.blood = p.spec.faintAt - 0.001;
    p.state = 'treating';
    p.wounds = 2;
    w.tick(0.5);
    expect(p.state).toBe('fainted');
    expect(w.shift.money).toBe(CONFIG.score.faint);
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: true, verb: 'lift' });
    press(w);
    expect(w.hand?.kind).toBe('stretcher');
    expect(w.beds[0].patient).toBeNull();
    at(w, 60, 160, 'side');
    const x0 = w.doctor.x;
    w.walk(1, 0, 0.5);
    expect(w.doctor.x - x0).toBeCloseTo(CONFIG.doctor.speed * CONFIG.doctor.carrying * 0.5, 0);
    const d = w.layout.stations.door.use;
    at(w, d.x + d.w / 2, d.y + d.h + 4, 'up');
    expect(press(w)).toContainEqual({ kind: 'deliver' });
    expect(w.hand).toBeNull();
  });

  it('lifting a fainted man beats sweeping the leeches at his feet', () => {
    const w = new Ward('priority');
    const p = untilPatient(w, 0);
    p.attach();
    p.blood = p.spec.faintAt;
    w.tick(0.1);
    expect(w.floor.length).toBe(1);
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: true, verb: 'lift' });
  });

  it('a fed leech by the bandage cupboard is picked up, not a bandage (the cupboard reaches only from its base)', () => {
    const w = new Ward('cupboard');
    const c = w.layout.stations.cupboard;
    // a leech on the floor just above the cupboard's sprite; the doctor beside it, facing it
    w.floor.push({ id: 999, x: c.box.x + 10, y: c.box.y - 4, angle: 0 });
    at(w, c.box.x + 10, c.box.y + 4, 'up');
    expect(w.target()).toMatchObject({ target: { kind: 'used', id: 999 } });
  });

  it('a leech that has gone (caught, scooped, squashed) cannot be acted on', () => {
    const w = new Ward('stale');
    w.escapees.push({ id: 7, x: 50, y: 150, angle: 0, bed: null, t: 0 }, { id: 8, x: 300, y: 150, angle: 0, bed: null, t: 0 });
    expect(w.interact({ kind: 'escapee', id: 99 })).toEqual([{ kind: 'fail', fail: 'nothing', target: { kind: 'escapee', id: 99 } }]);
    expect(w.escapees.map((e) => e.id)).toEqual([7, 8]);
    expect(w.check({ kind: 'used', id: 42 })).toEqual({ ok: false, fail: 'nothing' });
  });

  it('a failed interaction says why', () => {
    const w = new Ward('fail');
    byStation(w, 'cupboard');
    press(w);
    byStation(w, 'jar');
    const t: Target = { kind: 'station', id: 'jar' };
    expect(w.interact(t)).toEqual([{ kind: 'fail', fail: 'handsFull', target: t }]);
  });

  it('a chilled man takes no leech until warmed with a hot-water bottle', () => {
    const w = new Ward('cold', DAY2);
    const p = untilPatient(w, 0);
    Object.defineProperty(p, 'cold', { value: true });
    w.hand = { kind: 'leech', count: 2 };
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: false, fail: 'cold' });
    w.hand = { kind: 'bottle' };
    expect(w.target()?.check).toEqual({ ok: true, verb: 'warm' });
    press(w);
    expect(p.warmed).toBe(true);
    w.hand = { kind: 'leech', count: 2 };
    expect(w.target()?.check).toEqual({ ok: true, verb: 'apply' });
  });

  it('1828: the stove is brought up at three o’clock — not there (or in the way) before', () => {
    const w = new Ward('stove', DAY1);
    w.tick(0.1);
    expect(w.stoveIn).toBe(false);
    const st = w.layout.stations.stove;
    // he can stand where the stove will go, and nothing there answers to E
    at(w, st.foot!.x + st.foot!.w / 2, st.foot!.y + st.foot!.h, 'up');
    expect(w.target()?.target).not.toEqual({ kind: 'station', id: 'stove' });
    w.skipTo('chill');
    expect(w.stoveIn).toBe(true);
    expect(w.doctor.y).toBeGreaterThan(st.foot!.y + st.foot!.h); // stepped out of its way
    byStation(w, 'stove');
    expect(w.target()?.check).toEqual({ ok: true, verb: 'takeBottle' });
    // and on the later years it's there from the start
    const later = new Ward('stove', DAY2);
    later.tick(0.1);
    expect(later.stoveIn).toBe(true);
  });

  it('running onto fed leeches floors him: dazed, the leech squashed, his handful scattered', () => {
    const w = new Ward('slip');
    at(w, 60, 160, 'side');
    for (let i = 0; i < 12; i++) w.floor.push({ id: 500 + i, x: 64 + i * 6, y: 160, angle: 0 });
    w.hand = { kind: 'leech', count: 2 };
    let slipped = false;
    for (let i = 0; i < 40 && !slipped; i++) slipped = w.walk(1, 0, 0.05, true).some((e) => e.kind === 'slip');
    expect(slipped).toBe(true);
    expect(w.doctor.dazed).toBe(CONFIG.slip.dazed);
    expect(w.hand).toBeNull();
    expect(w.escapees.length).toBe(2);
    expect(w.lost).toBe(1);
    const x = w.doctor.x;
    w.walk(1, 0, 0.5);
    expect(w.doctor.x).toBe(x); // can't move while dazed
    expect(w.target()).toBeNull();
    for (let i = 0; i < CONFIG.slip.dazed * 10 + 1; i++) w.tick(0.1);
    expect(w.doctor.dazed).toBe(0);
  });

  it('walking over fed leeches never slips', () => {
    const w = new Ward('walkover');
    at(w, 40, 200, 'side');
    for (let i = 0; i < 30; i++) w.floor.push({ id: 2000 + i, x: 44 + i * 4, y: 200, angle: 0 });
    const ev: ReturnType<Ward['walk']> = [];
    for (let i = 0; i < 60; i++) ev.push(...w.walk(1, 0, 0.05));
    expect(ev.filter((e) => e.kind === 'slip')).toHaveLength(0);
    expect(w.doctor.dazed).toBe(0);
    expect(w.doctor.x).toBeGreaterThan(150); // walked straight over them all
  });

  it('running (Shift) is faster', () => {
    const walker = new Ward('run');
    const runner = new Ward('run');
    at(walker, 40, 200, 'side');
    at(runner, 40, 200, 'side');
    walker.walk(1, 0, 0.5);
    runner.walk(1, 0, 0.5, true);
    expect(runner.doctor.x - 40).toBeCloseTo((walker.doctor.x - 40) * CONFIG.run.speed, 3);
  });

  it('running over a single fed leech always floors him', () => {
    for (const seed of ['r1', 'r2', 'r3', 'r4', 'r5']) {
      const w = new Ward(seed);
      at(w, 40, 200, 'side');
      w.floor.push({ id: 1000, x: 52, y: 200, angle: 0 });
      let slipped = false;
      for (let i = 0; i < 20 && !slipped; i++) slipped = w.walk(1, 0, 0.03, true).some((e) => e.kind === 'slip');
      expect(slipped).toBe(true);
      expect(w.doctor.dazed).toBe(CONFIG.slip.dazed);
    }
  });

  it('running into an orderly knocks him down for 3 s; walking into one does not', () => {
    for (const run of [false, true]) {
      const w = new Ward('bump', DAY2);
      w.orderlies.push({ id: 77, x: 200, y: 147, route: [{ x: 200, y: 147 }, { x: 201, y: 147 }], leg: 1, waited: 0, facing: 'side', flip: false, moving: false, load: 0 });
      at(w, 180, 147, 'side');
      let ev: ReturnType<Ward['walk']> = [];
      for (let i = 0; i < 20 && !ev.length; i++) ev = w.walk(1, 0, 0.05, run);
      if (run) {
        expect(ev).toContainEqual(expect.objectContaining({ kind: 'collide' }));
        expect(w.doctor.dazed).toBe(CONFIG.run.stunned);
      } else {
        expect(w.doctor.dazed).toBe(0);
        expect(w.doctor.x).toBeLessThan(200 - 8); // simply stopped by him
      }
    }
  });

  it('day two: orderlies cross the ward and block the doctor', () => {
    const w = new Ward('orderlies', DAY2);
    let seen = false;
    for (let i = 0; i < 100 && !seen; i++) {
      w.tick(0.1);
      seen = w.orderlies.some((o) => o.x > 40 && o.x < 380);
    }
    expect(seen).toBe(true);
    const o = w.orderlies.find((x) => x.x > 40 && x.x < 380)!;
    // stand right in his path: he waits for the doctor
    at(w, o.x + (o.flip ? -12 : 12), o.y, 'side');
    const x0 = o.x;
    let jostled = false;
    for (let i = 0; i < 10; i++) jostled = w.tick(0.1).some((e) => e.kind === 'jostle') || jostled;
    expect(jostled).toBe(true);
    expect(Math.abs(o.x - x0)).toBeLessThan(2);
    // and the doctor can't walk through him
    const docX = w.doctor.x;
    w.walk(o.flip ? 1 : -1, 0, 0.3);
    expect(Math.abs(w.doctor.x - docX)).toBeLessThan(4);
  });

  it('the bdellometer arrives at midday on day two and pumps only while held', () => {
    const w = new Ward('machine', DAY2);
    w.tick(0.1);
    expect(w.deviceOnStand).toBe(false);
    w.skipTo('machine');
    expect(w.deviceOnStand).toBe(true);
    const p = untilPatient(w, 0);
    byStation(w, 'stand');
    press(w);
    expect(w.hand?.kind).toBe('bdello');
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: true, verb: 'pump' });
    for (let i = 0; i < 20; i++) w.pump(0, 0.1);
    expect(p.blood).toBeCloseTo(CONFIG.machine.rate * 2, 5);
    const b = p.blood;
    w.tick(1);
    expect(p.blood).toBe(b); // no after-bleed from the cup
  });

  it('day three: no deliveries, the machine from the start', () => {
    const w = new Ward('shortage', DAY3);
    w.tick(0.1);
    expect(w.deviceOnStand).toBe(true);
    const jar = w.supply.jar;
    let delivered = false;
    for (let i = 0; i < 600; i++) delivered = w.tick(0.1).some((e) => e.kind === 'delivery') || delivered;
    expect(delivered).toBe(false);
    expect(w.supply.jar).toBeLessThanOrEqual(jar);
  });

  it('escaped leeches crawl to the drain and cost a fine (not on day one)', () => {
    const quiet = new Ward('escape', DAY1);
    for (let i = 0; i < 600; i++) quiet.tick(0.1);
    expect(quiet.escapees.length + quiet.lost).toBe(0);

    const w = new Ward('escape', DAY2);
    let escaped = false;
    for (let i = 0; i < 1200 && !escaped; i++) escaped = w.tick(0.1).some((e) => e.kind === 'escape');
    expect(escaped).toBe(true);
    const e = w.escapees[0];
    let drained = false;
    for (let i = 0; i < 1500 && !drained; i++) {
      for (const x of w.escapees) x.bed = null;
      drained = w.tick(0.1).some((ev) => ev.kind === 'drain');
    }
    expect(drained).toBe(true);
    expect(w.lost).toBeGreaterThan(0);
    expect(Math.hypot(w.layout.drain.x - e.x, w.layout.drain.y - e.y)).toBeLessThan(4);
  });

  it('every carried thing has somewhere to go (no softlocks)', () => {
    const w = new Ward('homes', DAY2);
    w.skipTo('machine');
    const homes = { leech: 'jar', bandage: 'cupboard', bottle: 'stove', bdello: 'stand', used: 'bucket' } as const;
    for (const [kind, station] of Object.entries(homes)) {
      w.hand = kind === 'used' ? { kind: 'used', count: 2 } : kind === 'leech' ? { kind: 'leech', count: 3 } : ({ kind } as never);
      if (kind === 'bdello') w.deviceOnStand = false;
      expect(w.check({ kind: 'station', id: station }).ok).toBe(true);
    }
  });

  it('each day runs to the bell with nobody at the wheel', () => {
    CONFIG.days.forEach((day, i) => {
      const w = new Ward('idle', i);
      let bell = false;
      for (let n = 0; n < day.realSeconds * 10 + 10 && !bell; n++) bell = w.tick(0.1).some((e) => e.kind === 'bell');
      expect(bell).toBe(true);
      expect(w.shift.verdict()).toBe('REPRIMAND');
    });
  });
});
