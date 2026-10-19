// Which days are open and the best takings on each, kept in localStorage when the
// browser allows it (the game runs without it: day 1 is always open).

import { CONFIG } from '../config';

const KEY = 'lc-progress';

export interface Progress {
  unlocked: number; // highest day index that may be played
  best: (number | null)[]; // best francs per day
}

const fresh = (): Progress => ({ unlocked: 0, best: CONFIG.days.map(() => null) });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Progress;
    return { unlocked: Math.min(CONFIG.days.length - 1, p.unlocked ?? 0), best: CONFIG.days.map((_, i) => p.best?.[i] ?? null) };
  } catch {
    return fresh();
  }
}

// Record a finished day; returns whether it beat that day's best.
export function finishDay(day: number, money: number): boolean {
  const p = loadProgress();
  const record = p.best[day] == null || money > (p.best[day] as number);
  if (record) p.best[day] = money;
  p.unlocked = Math.max(p.unlocked, Math.min(CONFIG.days.length - 1, day + 1));
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
  return record;
}
