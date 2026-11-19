// The register: the ten best takings for each year. The browser keeps one of its own
// (ui/board.ts); the server keeps the one every doctor signs (the Leaderboard object in
// server/index.ts), and this is its book — pure, so the tests and the server share it.
//
// Playing alone, the browser works out the takings, so the server can't take them on
// trust. It checks what it can:
//   · no day earns more than every man who comes in bled just right (arrivals keep to the
//     clock whatever the doctor does, so that's the same for every seed and frame rate);
//   · a score comes with a ticket, asked for when the doors opened and good once, and not
//     before the day could have been worked (the ward's clock never runs ahead of real time);
//   · it works out the verdict itself, and cleans the name.
// What gets past that (a made-up score under the ceiling) is for the admin to strike out.

import { CONFIG } from '../config';
import { Shift, verdictFor } from '../model/shift';
import { REGISTER } from '../data/lines';
import { cleanName } from './protocol';

export const BOARD_SIZE = 10;
export const NAME_MAX = 12;

export interface BoardEntry {
  name: string;
  money: number;
  verdict: string;
  date: string; // yyyy-mm-dd, when it was signed
}

export interface Board {
  years: Record<string, BoardEntry[]>; // keyed by year: '1828', '1831', '1832'
}

export const emptyBoard = (): Board => ({ years: Object.fromEntries(CONFIG.days.map((d) => [String(d.year), []])) });

// Would this score make the board? (Ties go below earlier entries; a day with no takings never does.)
export const qualifies = (list: BoardEntry[], money: number) => money > 0 && (list.length < BOARD_SIZE || money > list[list.length - 1].money);

// Insert an entry; returns its place (0-based) or -1 if it didn't make the board.
export function place(list: BoardEntry[], e: BoardEntry): number {
  if (!qualifies(list, e.money)) return -1;
  let i = list.findIndex((x) => e.money > x.money);
  if (i < 0) i = list.length;
  list.splice(i, 0, e);
  list.length = Math.min(list.length, BOARD_SIZE);
  return i;
}

// A board as it arrives from anywhere (storage, the network): only what looks like entries.
export function tidyBoard(raw: unknown): Board {
  const b = emptyBoard();
  const years = (raw as Partial<Board> | null)?.years;
  if (!years || typeof years !== 'object') return b;
  for (const y of Object.keys(b.years)) {
    const list = (years as Record<string, unknown>)[y];
    if (!Array.isArray(list)) continue;
    b.years[y] = list
      .filter((e): e is BoardEntry => !!e && typeof e.name === 'string' && Number.isFinite(e.money))
      .map((e) => ({ name: e.name, money: e.money, verdict: String(e.verdict ?? ''), date: String(e.date ?? '') }))
      .slice(0, BOARD_SIZE);
  }
  return b;
}

// ── The server's book ────────────────────────────────────────────────────────

export const TICKET = {
  slack: 10, // seconds: a day may be signed this much sooner than its length (the network)
  life: 2 * 60 * 60, // seconds a ticket stays good: long enough for notes, a pause, a cup of tea
  perPlayer: 3, // live tickets for one address; asking for another drops the oldest
  total: 300, // live tickets in all; the oldest go first
};

// The most a day can earn: every man who comes in, bled just right.
let ceilings: number[] | null = null;
export function ceiling(day: number): number {
  ceilings ??= CONFIG.days.map((_, d) => {
    const shift = new Shift('ceiling', d);
    let men = 0;
    while (!shift.over) men += shift.tick(1 / 30).filter((e) => e.kind === 'arrival').length;
    return men * CONFIG.score.green;
  });
  return ceilings[day] ?? 0;
}

export interface Ticket {
  id: string;
  day: number; // 0-based index into CONFIG.days
  who: string; // a hash of the address it was given to
  at: number; // ms, when the doors opened
}

export interface BookState {
  years: Record<string, BoardEntry[]>;
  tickets: Ticket[];
}

export type SignRefusal = 'ticket' | 'early' | 'money';
export type Signed = { place: number; entry: BoardEntry } | { error: SignRefusal };

export class Book {
  private years: Record<string, BoardEntry[]>;
  private tickets: Ticket[];

  constructor(state?: Partial<BookState> | null) {
    this.years = tidyBoard(state).years;
    this.tickets = Array.isArray(state?.tickets) ? state.tickets : [];
  }

  get state(): BookState {
    return { years: this.years, tickets: this.tickets };
  }

  board(): Board {
    return { years: this.years };
  }

  // The doors are open on a day: a ticket to sign it with (null for no such day).
  start(day: number, who: string, id: string, now: number): string | null {
    if (!Number.isInteger(day) || !CONFIG.days[day]) return null;
    this.prune(now);
    const mine = this.tickets.filter((t) => t.who === who);
    const drop = new Set(mine.slice(0, Math.max(0, mine.length - TICKET.perPlayer + 1)));
    this.tickets = this.tickets.filter((t) => !drop.has(t));
    this.tickets.push({ id, day, who, at: now });
    if (this.tickets.length > TICKET.total) this.tickets.splice(0, this.tickets.length - TICKET.total);
    return id;
  }

  // Sign the register for a day worked: its place (-1 if it didn't make the board), or why not.
  // The ticket is spent either way.
  sign(id: string, rawName: unknown, money: number, now: number): Signed {
    this.prune(now);
    const t = this.tickets.find((x) => x.id === id);
    if (!t) return { error: 'ticket' };
    this.tickets = this.tickets.filter((x) => x !== t);
    const spec = CONFIG.days[t.day];
    if (now - t.at < (spec.realSeconds - TICKET.slack) * 1000) return { error: 'early' };
    if (!Number.isInteger(money) || money > ceiling(t.day)) return { error: 'money' };
    const entry: BoardEntry = {
      name: cleanName(rawName, REGISTER.anonymous).slice(0, NAME_MAX).trim() || REGISTER.anonymous,
      money,
      verdict: verdictFor(spec.verdict, money),
      date: new Date(now).toISOString().slice(0, 10),
    };
    const list = (this.years[String(spec.year)] ??= []);
    return { place: place(list, entry), entry };
  }

  // Strike out an entry (0-based place); returns it, or null if there's none there.
  remove(year: number, at: number): BoardEntry | null {
    const list = this.years[String(year)];
    if (!list || !Number.isInteger(at) || at < 0 || at >= list.length) return null;
    return list.splice(at, 1)[0];
  }

  private prune(now: number) {
    this.tickets = this.tickets.filter((t) => now - t.at < TICKET.life * 1000);
  }
}
