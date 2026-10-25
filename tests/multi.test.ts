import { describe, it, expect } from 'vitest';
import { Ward } from '../src/model/ward';
import { CONFIG } from '../src/config';

const grand = (doctors: number, day = 1) => new Ward('multi', day, { doctors, ward: 'grandeSalle' });

describe('doctors together', () => {
  it('the Grande Salle scales the day to the number of doctors', () => {
    const solo = new Ward('multi', 0);
    const four = grand(4, 0);
    expect(four.doctors).toHaveLength(4);
    expect(four.layout.beds).toHaveLength(12);
    expect(four.supply.jar).toBe(Math.round(CONFIG.days[0].jar * CONFIG.multi.jar[3]));
    expect(four.supply.cap).toBeGreaterThan(solo.supply.cap);
    expect(four.shift.thresholds.approved).toBe(Math.round(CONFIG.days[0].verdict.approved * CONFIG.multi.rate[3]));
    // and nobody starts on top of anyone else
    const spots = new Set(four.doctors.map((d) => `${d.x},${d.y}`));
    expect(spots.size).toBe(4);
  });

  it('they share one jar', () => {
    const w = grand(2);
    const jar = w.layout.stations.jar.use;
    const before = w.supply.jar;
    for (const d of w.doctors) {
      d.x = jar.x + jar.w / 2 + (d.id ? 6 : -6);
      d.y = jar.y + jar.h + 2;
      d.facing = 'up';
    }
    w.interact({ kind: 'station', id: 'jar' }, 0);
    w.interact({ kind: 'station', id: 'jar' }, 1);
    expect(w.supply.jar).toBe(before - 2);
    expect(w.doctors[0].hand).toEqual({ kind: 'leech', count: 1 });
    expect(w.doctors[1].hand).toEqual({ kind: 'leech', count: 1 });
  });

  it('walking into a colleague stops you; running into him knocks you both down', () => {
    const w = grand(2);
    const [a, b] = w.doctors;
    b.x = a.x + 12;
    b.y = a.y;
    for (let i = 0; i < 30; i++) w.walk(1, 0, 1 / 30, false, 0);
    expect(b.x - a.x).toBeGreaterThanOrEqual(8); // feet don't overlap
    expect(a.dazed).toBe(0);
    let ev: ReturnType<Ward['walk']> = [];
    for (let i = 0; i < 5 && !ev.length; i++) ev = w.walk(1, 0, 1 / 30, true, 0);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'knock', who: 0, other: 1 }));
    expect(a.dazed).toBe(CONFIG.run.stunned);
    expect(b.dazed).toBe(CONFIG.multi.knocked);
    expect(a.stats.knocked).toBe(1);
  });

  it('online, a run that ends at a colleague’s shoulder still knocks them both down', () => {
    const w = grand(2);
    const [a, b] = w.doctors;
    b.x = a.x + 8; // feet touching: his own screen stopped him here
    b.y = a.y;
    const ev = w.walkTo(0, a.x, a.y, true, 'side', false, 1, 0);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'knock', who: 0, other: 1 }));
    expect(b.dazed).toBe(CONFIG.multi.knocked);
  });

  it('only one can have the bdellometer, and the stand says who has it', () => {
    const w = grand(2);
    w.skipTo('machine');
    w.doctors[0].hand = { kind: 'bdello' };
    w.deviceOnStand = false;
    expect(w.check({ kind: 'station', id: 'stand' }, 1)).toEqual({ ok: false, fail: 'deviceBusy' });
  });

  it('a faint is put down to whoever last bled the man; a green bandage to whoever applied it', () => {
    const w = grand(2);
    w.tick(0.1); // the first men are shown to their beds
    const bed = w.beds.findIndex((b) => b.patient);
    const p = w.beds[bed].patient!;
    p.state = 'treating';
    p.by = 1;
    p.blood = p.spec.faintAt + 0.01;
    w.tick(0.1);
    expect(w.doctors[1].stats.faints).toBe(1);
    expect(w.doctors[0].stats.faints).toBe(0);
  });

  it('a doctor who leaves puts the bdellometer back on its stand and his leeches back in the jar', () => {
    const w = grand(3);
    w.doctors[1].hand = { kind: 'bdello' };
    w.deviceOnStand = false;
    w.doctors[2].hand = { kind: 'leech', count: 2 };
    const jar = w.supply.jar;
    w.dropOut(1);
    w.dropOut(2);
    expect(w.deviceOnStand).toBe(true);
    expect(w.supply.jar).toBe(jar + 2);
    expect(w.doctors[1].hand).toBeNull();
  });

  it('walkTo follows a player’s own screen, and still slips him at a run', () => {
    const w = grand(2);
    const d = w.doctors[1];
    w.walkTo(1, d.x + 5, d.y, false, 'side', false);
    expect(d.moving).toBe(true);
    w.floor.push({ id: 999, x: d.x + 4, y: d.y, angle: 0 });
    const ev = w.walkTo(1, d.x + 4, d.y, true, 'side', false);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'slip', who: 1 }));
    expect(d.stats.squashed).toBe(1);
    // and on the floor he goes nowhere, whatever his screen says
    const x = d.x;
    w.walkTo(1, x + 20, d.y, false, 'side', false);
    expect(d.x).toBe(x);
  });
});
