// Leechside Manor's server: one Cloudflare Worker, and three kinds of Durable Object. The
// Matchmaker (there is one) hands out room codes and knows which public rooms have space;
// each RoomObject is one game's room, running the very same ward model as a game alone
// (src/net/room.ts) on a thirty-a-second timer; the Leaderboard (there is one) keeps the
// register every doctor playing alone can sign (src/net/board.ts).
//
//   POST /api/create       → { code }   a private room, joined by its code
//   POST /api/match        → { code }   a public room with space, or a new one
//   GET  /api/room/:code   (WebSocket)  the game itself (src/net/protocol.ts)
//
//   GET  /api/board                          → { years }   the register: ten best per year
//   POST /api/board/start  { day }           → { ticket }  the doors are open on a day
//   POST /api/board/sign   { ticket, name, money } → { place, entry } (place -1: off the board)
//   DELETE /api/board/:year/:place  (Authorization: Bearer <BOARD_ADMIN>)  strike out an entry
//                                            (place as the board shows it: 1 is the top)

import { DurableObject } from 'cloudflare:workers';
import { Room, TICK, type Conn } from '../src/net/room';
import { CODE_LENGTH, CODE_LETTERS, isCode, type ErrorCode, type Phase } from '../src/net/protocol';
import { CONFIG } from '../src/config';
import { Book, type BookState } from '../src/net/board';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

// A small JSON body, or null.
async function body(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 1000) return null;
  try {
    const b = JSON.parse(text) as unknown;
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const sha256 = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));

// Who's asking, as far as tickets go: a hash of the address, never the address itself.
async function caller(req: Request): Promise<string> {
  const hash = new Uint8Array(await sha256(`leechside:${req.headers.get('CF-Connecting-IP') ?? ''}`));
  return [...hash.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The admin key, compared in constant time (hashing both first makes the lengths equal).
async function isAdmin(req: Request, env: Env): Promise<boolean> {
  const given = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  if (!given || !env.BOARD_ADMIN) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(env.BOARD_ADMIN)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// A socket that says why it can't let you in, then closes: a browser can't read the body
// of a refused WebSocket upgrade, but it can read a message.
function refuse(code: ErrorCode): Response {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.send(JSON.stringify({ t: 'error', code }));
  server.close(1000, code);
  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName('matchmaker'));

    if (url.pathname === '/api/create' && req.method === 'POST') return json(await mm.create(false));
    if (url.pathname === '/api/match' && req.method === 'POST') return json(await mm.match());

    if (url.pathname.startsWith('/api/board')) return board(req, url, env);

    const m = url.pathname.match(/^\/api\/room\/([A-Za-z]+)$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected a WebSocket' }, 426);
      const code = m[1].toUpperCase();
      const room = isCode(code) ? await mm.lookup(code) : null;
      if (!room) return refuse('missing');
      const headers = new Headers(req.headers);
      headers.set('X-Room', JSON.stringify({ code, public: room.public }));
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(req, { headers }));
    }
    return new Response('Leechside Manor: the multiplayer server is open.', { headers: CORS });
  },
};

// ── The register ─────────────────────────────────────────────────────────────

async function board(req: Request, url: URL, env: Env): Promise<Response> {
  const book = env.BOARD.get(env.BOARD.idFromName('register'));
  if (url.pathname === '/api/board' && req.method === 'GET') return json(await book.board());
  if (url.pathname === '/api/board/start' && req.method === 'POST') {
    const b = await body(req);
    const ticket = typeof b?.day === 'number' ? await book.start(b.day, await caller(req)) : null;
    return ticket ? json({ ticket }) : json({ error: 'day' }, 400);
  }
  if (url.pathname === '/api/board/sign' && req.method === 'POST') {
    const b = await body(req);
    if (typeof b?.ticket !== 'string' || typeof b.money !== 'number') return json({ error: 'request' }, 400);
    const signed = await book.sign(b.ticket, typeof b.name === 'string' ? b.name : '', b.money);
    return json(signed, 'error' in signed ? 400 : 200);
  }
  const strike = url.pathname.match(/^\/api\/board\/(\d{4})\/(\d+)$/);
  if (strike && req.method === 'DELETE') {
    if (!(await isAdmin(req, env))) return json({ error: 'unauthorised' }, 401);
    const removed = await book.remove(Number(strike[1]), Number(strike[2]) - 1);
    return removed ? json({ removed }) : json({ error: 'missing' }, 404);
  }
  return json({ error: 'not found' }, 404);
}

export class Leaderboard extends DurableObject<Env> {
  private book: Book | null = null;

  private async load(): Promise<Book> {
    this.book ??= new Book(await this.ctx.storage.get<BookState>('book'));
    return this.book;
  }

  private keep() {
    return this.ctx.storage.put('book', this.book!.state);
  }

  async board() {
    return (await this.load()).board();
  }

  async start(day: number, who: string) {
    const ticket = (await this.load()).start(day, who, crypto.randomUUID(), Date.now());
    if (ticket) await this.keep();
    return ticket;
  }

  async sign(ticket: string, name: string, money: number) {
    const signed = (await this.load()).sign(ticket, name, money, Date.now());
    await this.keep(); // the ticket is spent, whatever came of it
    return signed;
  }

  async remove(year: number, at: number) {
    const removed = (await this.load()).remove(year, at);
    if (removed) await this.keep();
    return removed;
  }
}

// ── The matchmaker ───────────────────────────────────────────────────────────

interface Listing {
  code: string;
  public: boolean;
  players: number;
  phase: Phase;
  created: number;
  updated: number;
  pencilled: number[]; // when quick match sent someone who hasn't arrived yet
}

const PENCIL = 15_000; // a seat held for a player on his way, until he arrives or this passes
const expected = (l: Listing, now: number) => l.players + l.pencilled.filter((t) => now - t < PENCIL).length;

const UNCLAIMED = 2 * 60_000; // a room nobody has entered is forgotten after this
const ABANDONED = 6 * 60 * 60_000; // …and any room that hasn't been heard from in this long

export class Matchmaker extends DurableObject<Env> {
  private rooms: Map<string, Listing> | null = null;

  private async load(): Promise<Map<string, Listing>> {
    if (!this.rooms) {
      const stored = await this.ctx.storage.list<Listing>({ prefix: 'room:' });
      this.rooms = new Map([...stored.values()].map((l) => [l.code, { ...l, pencilled: l.pencilled ?? [] }]));
    }
    const now = Date.now();
    for (const l of this.rooms.values()) {
      if ((expected(l, now) === 0 && now - l.updated > UNCLAIMED) || now - l.updated > ABANDONED) await this.forget(l.code);
    }
    return this.rooms;
  }

  private async save(l: Listing) {
    this.rooms!.set(l.code, l);
    await this.ctx.storage.put(`room:${l.code}`, l);
  }

  private async forget(code: string) {
    this.rooms!.delete(code);
    await this.ctx.storage.delete(`room:${code}`);
  }

  async create(isPublic: boolean): Promise<{ code: string }> {
    const rooms = await this.load();
    let code = '';
    const bytes = new Uint8Array(CODE_LENGTH);
    do {
      crypto.getRandomValues(bytes);
      code = [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
    } while (rooms.has(code));
    const now = Date.now();
    await this.save({ code, public: isPublic, players: 0, phase: 'lobby', created: now, updated: now, pencilled: isPublic ? [now] : [] });
    return { code };
  }

  // Quick match: the fullest public room still waiting for players, else a new one. The
  // place is pencilled in at once, so a rush of players doesn't all pick the last seat.
  async match(): Promise<{ code: string }> {
    const rooms = await this.load();
    const now = Date.now();
    const open = [...rooms.values()]
      .filter((l) => l.public && l.phase !== 'playing' && expected(l, now) < CONFIG.multi.maxPlayers)
      .sort((a, b) => expected(b, now) - expected(a, now) || a.created - b.created);
    const pick = open[0];
    if (!pick) return this.create(true);
    await this.save({ ...pick, pencilled: [...pick.pencilled.filter((t) => now - t < PENCIL), now] });
    return { code: pick.code };
  }

  async lookup(code: string): Promise<Listing | null> {
    return (await this.load()).get(code) ?? null;
  }

  // A room reports who's in and what it's doing; an empty room is closed.
  async update(code: string, players: number, phase: Phase): Promise<void> {
    const rooms = await this.load();
    const l = rooms.get(code);
    if (!l) return;
    if (players === 0) return this.forget(code);
    // someone arrived (or left): the oldest pencilled seat is his, or has lapsed
    const now = Date.now();
    const pencilled = l.pencilled.filter((t) => now - t < PENCIL).slice(players > l.players ? players - l.players : 0);
    await this.save({ ...l, players, phase, updated: now, pencilled });
  }
}

// ── A room ───────────────────────────────────────────────────────────────────

export class RoomObject extends DurableObject<Env> {
  private room: Room | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private owed = 0; // seconds of game time not yet ticked

  async fetch(req: Request): Promise<Response> {
    const info = JSON.parse(req.headers.get('X-Room') ?? 'null') as { code: string; public: boolean } | null;
    if (!info) return new Response('No room given', { status: 400 });
    if (!this.room) {
      const room = new Room(info.code, info.public);
      room.onChange = () => this.report(room);
      this.room = room;
    }
    const room = this.room;
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn: Conn = {
      id: crypto.randomUUID(),
      send: (msg) => {
        try {
          server.send(JSON.stringify(msg));
        } catch {
          // gone: the close handler will tidy up
        }
      },
      close: () => {
        try {
          server.close(1000, 'bye');
        } catch {
          // already closed
        }
      },
    };
    server.addEventListener('message', (e) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof e.data === 'string' ? e.data : '');
      } catch {
        return;
      }
      room.message(conn.id, msg as Parameters<Room['message']>[1]);
    });
    const gone = () => {
      room.leave(conn.id);
      conn.close();
      if (room.status.players === 0) this.stop();
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    if (room.join(conn)) this.start();
    return new Response(null, { status: 101, webSocket: client });
  }

  private report(room: Room) {
    const mm = this.env.MATCHMAKER.get(this.env.MATCHMAKER.idFromName('matchmaker'));
    const s = room.status;
    this.ctx.waitUntil(mm.update(room.code, s.players, s.phase).catch(() => {}));
  }

  // Fixed steps of game time, however the timer happens to fire.
  private start() {
    if (this.timer) return;
    this.last = Date.now();
    this.owed = 0;
    this.timer = setInterval(() => {
      const now = Date.now();
      this.owed = Math.min(this.owed + (now - this.last) / 1000, TICK * 6);
      this.last = now;
      while (this.owed >= TICK) {
        this.room?.tick(TICK);
        this.owed -= TICK;
      }
    }, 1000 * TICK);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.room = null;
  }
}
