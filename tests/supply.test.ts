import { describe, it, expect } from 'vitest';
import { Supply, type SupplyEvent } from '../src/model/supply';
import { CONFIG } from '../src/config';

const run = (s: Supply, seconds: number) => {
  const ev: SupplyEvent[] = [];
  for (let t = 0; t < seconds; t += 0.5) ev.push(...s.tick(0.5));
  return ev;
};

describe('Supply', () => {
  it('delivers on schedule up to the cap', () => {
    const s = new Supply();
    const ev = run(s, CONFIG.supply.deliveryEvery + 1);
    expect(ev.some((e) => e.kind === 'delivery')).toBe(true);
    run(s, 600);
    expect(s.jar).toBe(CONFIG.supply.cap);
  });

  it('a shortage warns, stops deliveries for a known time, then resumes at once', () => {
    const s = new Supply();
    s.jar = 0;
    expect(s.beginShortage()).toEqual([{ kind: 'shortageWarning' }]);
    const ev = run(s, CONFIG.supply.shortage.warnSeconds + 1);
    expect(ev.some((e) => e.kind === 'shortageStart')).toBe(true);
    const jarAtStart = s.jar;
    const during = run(s, CONFIG.supply.shortage.seconds - 2);
    expect(during.some((e) => e.kind === 'delivery')).toBe(false);
    expect(s.jar).toBe(jarAtStart);
    const after = run(s, 3);
    expect(after.some((e) => e.kind === 'shortageEnd')).toBe(true);
    expect(after.some((e) => e.kind === 'delivery')).toBe(true);
  });

  it('cannot take from an empty jar', () => {
    const s = new Supply();
    s.jar = 0;
    expect(s.take()).toBe(false);
  });
});
