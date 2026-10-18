import { describe, it, expect } from 'vitest';
import { Patient, type PatientEvent } from '../src/model/patient';
import { CONFIG } from '../src/config';

const profile = { name: 'Jean Girard', surname: 'Girard', rank: 'Pvt.', regiment: '42e de Ligne', portrait: {} };
const run = (p: Patient, seconds: number, step = 0.1, near = false) => {
  const events: PatientEvent[] = [];
  for (let t = 0; t < seconds; t += step) events.push(...p.tick(step, near));
  return events;
};

describe('Patient', () => {
  it('walks out if nobody touches him', () => {
    const p = new Patient('soldier', profile);
    const ev = run(p, CONFIG.patient.patience + 1);
    expect(ev.some((e) => e.kind === 'walkedOut')).toBe(true);
    expect(p.state).toBe('left');
  });

  it('a leech feeds, drops off, and its bite bleeds on', () => {
    const p = new Patient('soldier', profile);
    expect(p.attach({ stubborn: false })).toBe('ok');
    const ev = run(p, CONFIG.leech.feedSeconds + 0.2);
    expect(ev.filter((e) => e.kind === 'leechDone')).toHaveLength(1);
    expect(p.wounds).toBe(1);
    const before = p.blood;
    run(p, 2);
    expect(p.blood).toBeGreaterThan(before);
  });

  it('a stubborn leech refuses until the skin is sweetened', () => {
    const p = new Patient('soldier', profile);
    expect(p.attach({ stubborn: true })).toBe('refused');
    expect(p.prepare()).toBe(true);
    expect(p.attach({ stubborn: true })).toBe('ok');
  });

  it('holds at most three leeches', () => {
    const p = new Patient('soldier', profile);
    for (let i = 0; i < CONFIG.patient.maxLeeches; i++) expect(p.attach({ stubborn: false })).toBe('ok');
    expect(p.attach({ stubborn: false })).toBe('full');
  });

  it('lint in the green earns the full fee and drops attached leeches', () => {
    const p = new Patient('soldier', profile);
    p.attach({ stubborn: false });
    p.attach({ stubborn: false });
    p.attach({ stubborn: false });
    run(p, 5); // 3 leeches × ~0.022/s × 5s ≈ 0.33: still red
    expect(p.zone()).toBe('red');
    while (p.zone() === 'red') p.pump(0.1);
    expect(p.zone()).toBe('green');
    const r = p.bandage()!;
    expect(r.outcome).toBe('green');
    expect(r.fee).toBe(CONFIG.score.green);
    expect(r.dropped).toBe(3);
    expect(p.state).toBe('done');
    expect(p.tick(1)).toEqual([]);
  });

  it('lint too early pays less', () => {
    const p = new Patient('soldier', profile);
    p.attach({ stubborn: false });
    expect(p.bandage()!.outcome).toBe('early');
  });

  it('three leeches and the after-bleed will faint an anaemic man', () => {
    const p = new Patient('anaemic', profile);
    p.attach({ stubborn: false });
    p.attach({ stubborn: false });
    p.attach({ stubborn: false });
    const ev = run(p, 30);
    const faint = ev.find((e) => e.kind === 'faint');
    expect(faint).toBeTruthy();
    expect(p.state).toBe('fainted');
    expect(p.leeches.every((l) => l === null)).toBe(true);
    expect(p.bandage()).toBeNull(); // no lint for a fainted man: carry him out
  });

  it('warns (blue) before fainting', () => {
    const p = new Patient('soldier', profile);
    const ev: PatientEvent[] = [];
    while (p.active) ev.push(...p.pump(0.05));
    const kinds = ev.map((e) => e.kind);
    expect(kinds.indexOf('ready')).toBeLessThan(kinds.indexOf('warning'));
    expect(kinds.indexOf('warning')).toBeLessThan(kinds.indexOf('faint'));
  });

  it('one leech on an anaemic man lands in the green with time to spare', () => {
    const p = new Patient('anaemic', profile);
    p.attach({ stubborn: false });
    let greenFor = 0;
    for (let t = 0; t < 60 && p.active; t += 0.1) {
      p.tick(0.1);
      if (p.zone() === 'green') greenFor += 0.1;
    }
    expect(greenFor).toBeGreaterThan(5);
  });

  it('a nervous conscript left alone faints from fright; company calms him', () => {
    const alone = new Patient('nervous', profile);
    alone.attach({ stubborn: false }); // one leech: he'd survive the blood loss, not the fear
    const { rise, perLeech } = CONFIG.patient.panic;
    const ev = run(alone, (1 - perLeech) / rise + 2);
    expect(ev.some((e) => e.kind === 'faint' && e.cause === 'fright')).toBe(true);
    const company = new Patient('nervous', profile);
    company.attach({ stubborn: false });
    run(company, 10, 0.1, true);
    expect(company.panic).toBe(0);
  });

  it('pallor climbs the ladder; anaemic men start pale', () => {
    expect(new Patient('soldier', profile).pallorRung()).toBe(0);
    expect(new Patient('anaemic', profile).pallorRung()).toBe(2);
  });
});
