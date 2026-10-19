import { describe, it, expect } from 'vitest';
import { Supply } from '../src/model/supply';
import { CONFIG } from '../src/config';

const run = (s: Supply, seconds: number) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.1) out.push(...s.tick(0.1));
  return out;
};

describe('Supply', () => {
  it('her boy brings leeches up to the cap', () => {
    const s = new Supply(8, { every: 24, size: 4 });
    const ev = run(s, 24 * 6);
    expect(ev.length).toBeGreaterThan(0);
    expect(s.jar).toBe(CONFIG.supply.cap);
  });

  it('in the cholera year nothing comes', () => {
    const s = new Supply(14, null);
    s.take();
    expect(run(s, 200)).toEqual([]);
    expect(s.jar).toBe(13);
  });

  it('an empty jar gives nothing', () => {
    const s = new Supply(1, null);
    expect(s.take()).toBe(true);
    expect(s.take()).toBe(false);
    expect(s.jar).toBe(0);
  });
});
