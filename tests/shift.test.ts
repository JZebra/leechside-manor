import { describe, it, expect } from 'vitest';
import { Shift, type ShiftEvent } from '../src/model/shift';
import { CONFIG } from '../src/config';

const runDay = (s: Shift) => {
  const ev: ShiftEvent[] = [];
  for (let t = 0; t < s.spec.realSeconds + 5; t += 0.25) ev.push(...s.tick(0.25));
  return ev;
};

describe('Shift', () => {
  it('each day runs from eight to the bell, through its stages in order, with arrivals', () => {
    CONFIG.days.forEach((day, i) => {
      const s = new Shift('test', i);
      const ev = runDay(s);
      const stages = ev.filter((e) => e.kind === 'stage').map((e) => (e as { id: string }).id);
      expect(stages).toEqual(day.stages.map((x) => x.id));
      expect(ev.filter((e) => e.kind === 'bell')).toHaveLength(1);
      expect(ev.filter((e) => e.kind === 'arrival').length).toBeGreaterThan(10);
      expect(s.over).toBe(true);
      expect(s.tick(1)).toEqual([]);
    });
  });

  it('the opening patients arrive at once, then the next waits a full interval', () => {
    const s = new Shift('test');
    const first = [...s.tick(0.1), ...s.tick(0.1), ...s.tick(0.1)];
    expect(first.filter((e) => e.kind === 'arrival')).toHaveLength(CONFIG.arrivals.opening);
  });

  it('day one: only soldiers until noon brings the anaemic', () => {
    const s = new Shift('test', 0);
    const ev: ShiftEvent[] = [];
    while (s.minutes < 12 * 60 - 1) ev.push(...s.tick(0.25));
    const types = new Set(ev.filter((e) => e.kind === 'arrival').map((e) => (e as { type: string }).type));
    expect([...types]).toEqual(['soldier']);
  });

  it('no cold men on day one; some on day two', () => {
    const colds = (day: number) => runDay(new Shift('cold', day)).filter((e) => e.kind === 'arrival' && e.cold).length;
    expect(colds(0)).toBe(0);
    expect(colds(1)).toBeGreaterThan(0);
  });
});
