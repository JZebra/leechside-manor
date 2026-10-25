// The leaderboard: the ten best takings for each year.
// Kept in this browser's localStorage (the game runs without it: the board is just empty).

import { CONFIG } from '../config';

const KEY = 'lc-board';
const NAME_KEY = 'lc-name';
export const BOARD_SIZE = 10;
export const NAME_MAX = 12;

export interface BoardEntry {
  name: string;
  money: number;
  verdict: string;
  date: string; // yyyy-mm-dd, when it was played
}

export interface Board {
  years: Record<string, BoardEntry[]>; // keyed by year: '1828', '1831', '1832'
}

const empty = (): Board => ({ years: Object.fromEntries(CONFIG.days.map((d) => [String(d.year), []])) });

export function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const b = JSON.parse(raw) as Partial<Board>;
    const fresh = empty();
    for (const y of Object.keys(fresh.years)) fresh.years[y] = (b.years?.[y] ?? []).slice(0, BOARD_SIZE);
    return fresh;
  } catch {
    return empty();
  }
}

function save(b: Board) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

// Would this score make the board? (Ties go below earlier entries; a day with no takings never does.)
export const qualifies = (list: BoardEntry[], money: number) => money > 0 && (list.length < BOARD_SIZE || money > list[list.length - 1].money);

// Insert an entry; returns its place (0-based) or -1 if it didn't make the board.
function place(list: BoardEntry[], e: BoardEntry): number {
  if (!qualifies(list, e.money)) return -1;
  let i = list.findIndex((x) => e.money > x.money);
  if (i < 0) i = list.length;
  list.splice(i, 0, e);
  list.length = Math.min(list.length, BOARD_SIZE);
  return i;
}

export function signYear(year: number, e: BoardEntry): number {
  const b = loadBoard();
  const at = place(b.years[String(year)] ?? (b.years[String(year)] = []), e);
  save(b);
  return at;
}

export function lastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage unavailable */
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
