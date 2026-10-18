import { describe, it, expect } from 'vitest';
import { Shift, type ShiftEvent } from '../src/model/shift';
import { CONFIG } from '../src/config';

describe('Shift', () => {
  it('runs from eight to the bell, through every stage in order, with arrivals', () => {
    const s = new Shift('test');
    const ev: ShiftEvent[] = [];
    for (let t = 0; t < CONFIG.shift.realSeconds + 5; t += 0.25) ev.push(...s.tick(0.25));
    const stages = ev.filter((e) => e.kind === 'stage').map((e) => (e as { id: string }).id);
    expect(stages).toEqual(CONFIG.stages.map((x) => x.id));
    expect(ev.filter((e) => e.kind === 'bell')).toHaveLength(1);
    const arrivals = ev.filter((e) => e.kind === 'arrival');
    expect(arrivals.length).toBeGreaterThan(20);
    expect(s.over).toBe(true);
    expect(s.tick(1)).toEqual([]);
  });

  it('the opening patients arrive at once, then the next waits a full interval', () => {
    const s = new Shift('test');
    const first = [...s.tick(0.1), ...s.tick(0.1), ...s.tick(0.1)];
    expect(first.filter((e) => e.kind === 'arrival')).toHaveLength(CONFIG.arrivals.opening);
  });

  it('only soldiers before the frail stage', () => {
    const s = new Shift('test');
    const ev: ShiftEvent[] = [];
    while (s.minutes < CONFIG.stages[1].at - 1) ev.push(...s.tick(0.25));
    const types = new Set(ev.filter((e) => e.kind === 'arrival').map((e) => (e as { type: string }).type));
    expect([...types]).toEqual(['soldier']);
  });
});
