import { describe, it, expect } from 'vitest';
import { Ward, type Target } from '../src/model/ward';
import { CONFIG } from '../src/config';
import { BEDS, BED, STATIONS, DRAIN } from '../src/model/layout';

const at = (w: Ward, x: number, y: number) => Object.assign(w.doctor, { x, y });
const byBed = (w: Ward, i: number) => at(w, BEDS[i].x + BED.w / 2, BEDS[i].y + BED.h + 6);
const byStation = (w: Ward, id: keyof typeof STATIONS) => {
  const b = STATIONS[id].box;
  at(w, b.x + b.w / 2, b.y + b.h + 5);
};
function press(w: Ward) {
  const t = w.target();
  if (!t) throw new Error('nothing in reach');
  return w.interact(t.target);
}
// run the clock until bed i has a patient
function untilPatient(w: Ward, i = 0) {
  for (let n = 0; n < 200 && !w.beds[i].patient; n++) w.tick(0.1);
  expect(w.beds[i].patient).toBeTruthy();
  return w.beds[i].patient!;
}

describe('the ward', () => {
  it('the doctor cannot walk through a bed', () => {
    const w = new Ward('walls');
    byBed(w, 0);
    for (let i = 0; i < 60; i++) w.walk(0, -1, 0.05);
    expect(w.doctor.y).toBeGreaterThanOrEqual(BEDS[0].y + BED.h);
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
    expect(w.hand).toEqual({ kind: 'leech', held: [false] });
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
    at(w, f.x, f.y);
    press(w);
    expect(w.hand).toEqual({ kind: 'used', count: 1 });
    byStation(w, 'bucket');
    press(w);
    expect(w.salting.length).toBe(1);
    const before = w.supply.jar;
    for (let i = 0; i < CONFIG.leech.recycleSeconds * 10 + 2; i++) w.tick(0.1);
    expect(w.supply.jar).toBeGreaterThan(before);
  });

  it('lint in the green pays the full fee', () => {
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
    const x0 = w.doctor.x;
    w.walk(1, 0, 1);
    expect(w.doctor.x - x0).toBeCloseTo(CONFIG.doctor.speed * CONFIG.doctor.carrying, 0);
    const d = STATIONS.door.box;
    at(w, d.x + d.w / 2, d.y + d.h + 6);
    expect(press(w)).toContainEqual({ kind: 'deliver' });
    expect(w.hand).toBeNull();
  });

  it('lifting a fainted man beats sweeping the leeches at his feet', () => {
    const w = new Ward('priority');
    const p = untilPatient(w, 0);
    p.attach({ stubborn: false });
    p.blood = p.spec.faintAt;
    w.tick(0.1);
    expect(w.floor.length).toBe(1);
    const f = w.floor[0];
    at(w, f.x, f.y + 3);
    expect(w.target()?.check).toEqual({ ok: true, verb: 'lift' });
  });

  it('a failed interaction says why', () => {
    const w = new Ward('fail');
    byStation(w, 'cupboard');
    press(w);
    byStation(w, 'jar');
    const t: Target = { kind: 'station', id: 'jar' };
    expect(w.interact(t)).toEqual([{ kind: 'fail', fail: 'handsFull', target: t }]);
  });

  it('a stubborn leech is refused until the man is warmed', () => {
    const w = new Ward('stubborn');
    const p = untilPatient(w, 0);
    w.hand = { kind: 'leech', held: [true] };
    byBed(w, 0);
    expect(w.target()?.check).toEqual({ ok: false, fail: 'refused' });
    w.hand = { kind: 'sugar' };
    press(w);
    expect(p.prepared).toBe(true);
    w.hand = { kind: 'leech', held: [true] };
    expect(w.target()?.check).toEqual({ ok: true, verb: 'apply' });
  });

  it('the bdellometer arrives at half past one and pumps only while held', () => {
    const w = new Ward('machine');
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

  it('escaped leeches crawl to the drain and cost a fine', () => {
    const w = new Ward('escape');
    w.skipTo('stubborn');
    let escaped = false;
    for (let i = 0; i < 1200 && !escaped; i++) escaped = w.tick(0.1).some((e) => e.kind === 'escape');
    expect(escaped).toBe(true);
    const e = w.escapees[0];
    e.bed = null; // make sure it heads for the drain
    let drained = false;
    for (let i = 0; i < 1200 && !drained; i++) {
      for (const x of w.escapees) x.bed = null;
      drained = w.tick(0.1).some((ev) => ev.kind === 'drain');
    }
    expect(drained).toBe(true);
    expect(w.lost).toBeGreaterThan(0);
    expect(Math.hypot(DRAIN.x - e.x, DRAIN.y - e.y)).toBeLessThan(4);
  });

  it('a handful: three leeches from the jar, the stubborn one goes back, a calm one bites first', () => {
    const w = new Ward('handful');
    const p = untilPatient(w, 0);
    byStation(w, 'jar');
    press(w);
    press(w);
    press(w);
    expect(w.hand).toEqual({ kind: 'leech', held: [false, false, false] });
    expect(w.target()?.check).toEqual({ ok: false, fail: 'handful' });
    w.hand = { kind: 'leech', held: [true, false] };
    const jar = w.supply.jar;
    expect(w.target()?.check).toEqual({ ok: true, verb: 'putBackSulky' });
    press(w);
    expect(w.hand).toEqual({ kind: 'leech', held: [false] });
    expect(w.supply.jar).toBe(jar + 1);
    w.hand = { kind: 'leech', held: [true, false] };
    byBed(w, 0);
    press(w);
    expect(w.hand).toEqual({ kind: 'leech', held: [true] }); // the calm one bit; the sulker is still in hand
    expect(p.attachedCount).toBe(1);
    expect(w.target()?.check).toEqual({ ok: false, fail: 'refused' });
  });

  it('every carried thing has somewhere to go (no softlocks)', () => {
    const w = new Ward('homes');
    w.skipTo('machine');
    const homes = { leech: 'jar', lint: 'cupboard', sugar: 'stove', bdello: 'stand', used: 'bucket' } as const;
    for (const [kind, station] of Object.entries(homes)) {
      w.hand = kind === 'used' ? { kind: 'used', count: 2 } : kind === 'leech' ? { kind: 'leech', held: [true] } : ({ kind } as never);
      if (kind === 'bdello') w.deviceOnStand = false;
      expect(w.check({ kind: 'station', id: station }).ok).toBe(true);
    }
  });

  it('a whole shift runs to the bell with nobody at the wheel', () => {
    const w = new Ward('idle');
    let bell = false;
    for (let i = 0; i < CONFIG.shift.realSeconds * 10 + 10 && !bell; i++) bell = w.tick(0.1).some((e) => e.kind === 'bell');
    expect(bell).toBe(true);
    expect(w.shift.verdict()).toBe('REPRIMAND');
  });
});
