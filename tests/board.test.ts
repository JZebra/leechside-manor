import { describe, it, expect, beforeEach } from 'vitest';
import { loadBoard, signYear, qualifies, BOARD_SIZE, ordinal } from '../src/ui/board';

// a stand-in for the browser's localStorage
beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
});

const entry = (name: string, money: number) => ({ name, money, verdict: 'NOTED', date: '2026-10-24' });

describe('the leaderboard', () => {
  it('keeps each year’s ten best, highest first; ties go below', () => {
    for (let i = 0; i < 12; i++) signYear(1828, entry(`n${i}`, i * 10));
    const list = loadBoard().years['1828'];
    expect(list).toHaveLength(BOARD_SIZE);
    expect(list[0].money).toBe(110);
    expect(list.at(-1)!.money).toBe(20);
    expect(signYear(1828, entry('tie', 110))).toBe(1); // equal to the best: placed second
    expect(qualifies(loadBoard().years['1828'], 10)).toBe(false);
    expect(qualifies([], 0)).toBe(false); // an empty board still wants takings
  });

  it('each year has its own board', () => {
    expect(signYear(1831, entry('a', 50))).toBe(0);
    const b = loadBoard();
    expect(b.years['1828']).toHaveLength(0);
    expect(b.years['1831'][0].name).toBe('a');
  });

  it('runs without storage: an empty board, nothing thrown', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(loadBoard().years['1832']).toEqual([]);
    expect(() => signYear(1832, entry('x', 1))).not.toThrow();
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});
