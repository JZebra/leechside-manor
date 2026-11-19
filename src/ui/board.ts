// The leaderboard: the ten best takings for each year, twice over. This browser keeps its
// own in localStorage (the game runs without it: the board is just empty); when the game
// has a server (net/client.ts) there's also the register every doctor signs, kept there.

import { SERVER } from '../net/client';
import { emptyBoard, place, tidyBoard, type Board, type BoardEntry } from '../net/board';

export { BOARD_SIZE, NAME_MAX, qualifies, type Board, type BoardEntry } from '../net/board';

const KEY = 'lc-board';
const NAME_KEY = 'lc-name';

export function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? tidyBoard(JSON.parse(raw)) : emptyBoard();
  } catch {
    return emptyBoard();
  }
}

function save(b: Board) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
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

// ── The online register ──────────────────────────────────────────────────────

const WAIT = 5000; // ms before giving up on the server

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!SERVER) throw new Error('unset');
  const r = await fetch(`${SERVER}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(WAIT),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

// The ticket for the day being worked: asked for when the doors open, spent on signing.
let ticket: { day: number; id: string } | null = null;
let asked = 0; // only the latest day's answer counts

export function startDay(day: number | null) {
  ticket = null;
  const n = ++asked;
  if (!SERVER || day === null) return;
  call<{ ticket: string }>('/api/board/start', { day })
    .then((r) => {
      if (n === asked && typeof r.ticket === 'string') ticket = { day, id: r.ticket };
    })
    .catch(() => {}); // no server, no ticket: the day can still go in this browser's register
}

export const hasTicket = (day: number) => ticket?.day === day;

// Everyone's register, or null if it can't be had.
export async function fetchBoard(): Promise<Board | null> {
  try {
    return tidyBoard(await call<unknown>('/api/board'));
  } catch {
    return null;
  }
}

// Sign the online register for the day just worked: the place (0-based, -1 off the board),
// or null if it couldn't be signed.
export async function signOnline(day: number, name: string, money: number): Promise<number | null> {
  if (!hasTicket(day)) return null;
  const id = ticket!.id;
  ticket = null;
  try {
    const r = await call<{ place?: number }>('/api/board/sign', { ticket: id, name, money });
    return typeof r.place === 'number' ? r.place : null;
  } catch {
    return null;
  }
}
