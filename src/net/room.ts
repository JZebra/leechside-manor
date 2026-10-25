// One game's room on the server: the lobby (who's in, who's ready, which year), the
// countdown, then the ward itself, ticking thirty times a second and sending snapshots
// fifteen times a second. Pure logic: the Cloudflare Durable Object (server/) owns the
// sockets and the timer, and tests drive it with pretend connections.

import { CONFIG } from '../config';
import { Ward, type Facing, type WardEvent } from '../model/ward';
import { Snapshotter } from './snapshot';
import { PROTOCOL, cleanName, type ClientMsg, type LobbyState, type Phase, type Report, type Seat, type ServerMsg } from './protocol';

export interface Conn {
  id: string;
  send(msg: ServerMsg): void;
  close(): void;
}

interface Player {
  conn: Conn;
  slot: number;
  name: string;
  ready: boolean;
  doctor: number | null; // his doctor in the ward, while a game is on
  pump: boolean; // holding E with the bdellometer
}

export const TICK = 1 / 30; // seconds per server tick
const SNAP_EVERY = 2; // ticks per snapshot
const COUNTDOWN = 3; // seconds from everyone ready to the doors opening
const FACINGS: Facing[] = ['down', 'up', 'side'];

export class Room {
  readonly code: string;
  readonly isPublic: boolean;
  onChange: () => void = () => {}; // tell the matchmaker (who's in, what phase)
  private players: Player[] = [];
  private host: string | null = null;
  private phase: Phase = 'lobby';
  private day = 0;
  private countdown = 0;
  private ward: Ward | null = null;
  private seats: Seat[] = [];
  private snapshotter = new Snapshotter();
  private pending: WardEvent[] = [];
  private ticks = 0;
  private readonly newSeed: () => string;

  constructor(code: string, isPublic: boolean, newSeed: () => string = () => Math.random().toString(36).slice(2, 10)) {
    this.code = code;
    this.isPublic = isPublic;
    this.newSeed = newSeed;
  }

  get status() {
    return { players: this.players.length, phase: this.phase, public: this.isPublic };
  }

  // The ward in play (tests look at it).
  get game(): Ward | null {
    return this.ward;
  }

  join(conn: Conn): boolean {
    const refuse = (code: 'full' | 'started') => {
      conn.send({ t: 'error', code });
      conn.close();
      return false;
    };
    if (this.players.length >= CONFIG.multi.maxPlayers) return refuse('full');
    if (this.phase === 'playing') return refuse('started');
    const used = new Set(this.players.map((p) => p.slot));
    const slot = [0, 1, 2, 3].find((s) => !used.has(s))!;
    this.players.push({ conn, slot, name: `Doctor ${slot + 1}`, ready: false, doctor: null, pump: false });
    this.host ??= conn.id;
    conn.send({ t: 'welcome', you: conn.id });
    this.review();
    this.changed();
    return true;
  }

  leave(id: string) {
    const i = this.players.findIndex((p) => p.conn.id === id);
    if (i < 0) return;
    const [p] = this.players.splice(i, 1);
    if (this.ward && p.doctor != null) this.ward.dropOut(p.doctor);
    if (this.host === id) this.host = this.players[0]?.conn.id ?? null;
    if (!this.players.length) this.reset();
    else this.review();
    this.changed();
  }

  message(id: string, msg: ClientMsg) {
    const p = this.players.find((x) => x.conn.id === id);
    if (!p || !msg || typeof msg !== 'object') return;
    const w = this.ward;
    switch (msg.t) {
      case 'hello':
        if (msg.v !== PROTOCOL) {
          p.conn.send({ t: 'error', code: 'version' });
          p.conn.close();
          return;
        }
        p.name = cleanName(msg.name, `Doctor ${p.slot + 1}`);
        this.broadcastLobby();
        return;
      case 'ready':
        if (this.phase === 'playing') return;
        p.ready = !!msg.ready;
        this.review();
        this.changed();
        return;
      case 'day':
        if (id !== this.host || this.phase === 'playing') return;
        if (Number.isInteger(msg.day) && msg.day >= 0 && msg.day < CONFIG.days.length) this.day = msg.day;
        this.broadcastLobby();
        return;
      case 'move': {
        if (!w || p.doctor == null || !Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
        const facing = FACINGS.includes(msg.facing) ? msg.facing : 'down';
        this.pending.push(...w.walkTo(p.doctor, msg.x, msg.y, !!msg.run, facing, !!msg.flip, Math.sign(msg.ix) || 0, Math.sign(msg.iy) || 0));
        return;
      }
      case 'press': {
        if (!w || p.doctor == null) return;
        const tg = w.target(p.doctor);
        if (tg && !(tg.check.ok && tg.check.verb === 'pump')) this.pending.push(...w.interact(tg.target, p.doctor));
        return;
      }
      case 'pump':
        p.pump = !!msg.on;
        return;
    }
  }

  tick(dt = TICK) {
    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (this.countdown <= 0) this.start();
      else if (Math.ceil(this.countdown) !== before) this.broadcastLobby();
      return;
    }
    const w = this.ward;
    if (this.phase !== 'playing' || !w) return;
    for (const p of this.players) {
      if (!p.pump || p.doctor == null) continue;
      const tg = w.target(p.doctor);
      if (tg?.check.ok && tg.check.verb === 'pump' && tg.target.kind === 'bed') this.pending.push(...w.pump(tg.target.bed, dt, p.doctor));
    }
    this.pending.push(...w.tick(dt));
    this.ticks++;
    if (w.over) {
      this.sendSnap();
      this.finish(w);
    } else if (this.ticks % SNAP_EVERY === 0) this.sendSnap();
  }

  private start() {
    const players = [...this.players].sort((a, b) => a.slot - b.slot);
    players.forEach((p, i) => {
      p.doctor = i;
      p.pump = false;
    });
    this.seats = players.map((p) => ({ id: p.conn.id, doctor: p.doctor!, slot: p.slot, name: p.name }));
    const seed = this.newSeed();
    this.ward = new Ward(seed, this.day, { doctors: players.length, ward: CONFIG.multi.ward });
    this.snapshotter = new Snapshotter();
    this.pending = [];
    this.ticks = 0;
    this.phase = 'playing';
    this.broadcast({ t: 'start', day: this.day, seed, seats: this.seats });
    this.sendSnap();
    this.changed();
  }

  private sendSnap() {
    if (!this.ward) return;
    this.broadcast({ t: 'snap', s: this.snapshotter.take(this.ward), ev: this.pending });
    this.pending = [];
  }

  // The six o'clock bell: the report to everyone, then back to the lobby for the next year.
  private finish(w: Ward) {
    const report: Report = {
      day: this.day,
      money: w.shift.money,
      verdict: w.shift.verdict(),
      thresholds: w.shift.thresholds,
      log: w.shift.log,
      applied: w.applied,
      lost: w.lost,
      slips: w.slips,
      floorAtBell: w.floorAtBell,
      credits: this.seats.map((s) => ({ slot: s.slot, name: s.name, ...w.doctors[s.doctor].stats })),
    };
    this.broadcast({ t: 'over', report });
    this.day = Math.min(this.day + 1, CONFIG.days.length - 1);
    this.reset();
    this.changed();
  }

  private reset() {
    this.phase = 'lobby';
    this.ward = null;
    for (const p of this.players) {
      p.ready = false;
      p.doctor = null;
      p.pump = false;
    }
  }

  // Between games the doors open three seconds after everyone is ready; anyone arriving
  // or changing his mind stops the count.
  private review() {
    if (this.phase === 'playing') return;
    const all = this.players.length > 0 && this.players.every((p) => p.ready);
    if (all && this.phase !== 'countdown') this.countdown = COUNTDOWN;
    this.phase = all ? 'countdown' : 'lobby';
  }

  private lobby(): LobbyState {
    return {
      code: this.code,
      public: this.isPublic,
      players: this.players.map((p) => ({ id: p.conn.id, slot: p.slot, name: p.name, ready: p.ready, host: p.conn.id === this.host })),
      day: this.day,
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
    };
  }

  private broadcastLobby() {
    this.broadcast({ t: 'lobby', lobby: this.lobby() });
  }

  private changed() {
    this.broadcastLobby();
    this.onChange();
  }

  private broadcast(msg: ServerMsg) {
    for (const p of this.players) p.conn.send(msg);
  }
}
