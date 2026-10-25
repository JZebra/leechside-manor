import { describe, it, expect } from 'vitest';
import { Room, TICK, type Conn } from '../src/net/room';
import { applySnapshot, Snapshotter, type PatientRecord } from '../src/net/snapshot';
import { PROTOCOL, cleanName, type ServerMsg } from '../src/net/protocol';
import { Ward } from '../src/model/ward';
import { CONFIG } from '../src/config';

class Fake implements Conn {
  inbox: ServerMsg[] = [];
  closed = false;
  constructor(readonly id: string) {}
  send(m: ServerMsg) {
    this.inbox.push(JSON.parse(JSON.stringify(m))); // as it would arrive: plain JSON
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    return [...this.inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  }
}

function room(n: number) {
  const r = new Room('ABCD', false, () => 'seed');
  const conns = Array.from({ length: n }, (_, i) => new Fake(`p${i}`));
  for (const c of conns) {
    r.join(c);
    r.message(c.id, { t: 'hello', name: `Dr ${c.id}`, v: PROTOCOL });
  }
  return { r, conns };
}

const runFor = (r: Room, seconds: number) => {
  for (let t = 0; t < seconds; t += TICK) r.tick();
};

describe('the room', () => {
  it('welcomes up to four, gives each a coat colour, and turns the fifth away', () => {
    const { r, conns } = room(4);
    expect(conns[0].last('welcome')).toEqual({ t: 'welcome', you: 'p0' });
    const lobby = conns[3].last('lobby')!.lobby;
    expect(lobby.players.map((p) => p.slot)).toEqual([0, 1, 2, 3]);
    expect(lobby.players[0].host).toBe(true);
    expect(lobby.players[2].name).toBe('Dr p2');
    const fifth = new Fake('p4');
    expect(r.join(fifth)).toBe(false);
    expect(fifth.last('error')).toEqual({ t: 'error', code: 'full' });
    expect(fifth.closed).toBe(true);
  });

  it('counts down once everyone is ready, and stops if someone changes his mind or arrives', () => {
    const { r, conns } = room(2);
    r.message('p0', { t: 'ready', ready: true });
    expect(r.status.phase).toBe('lobby');
    r.message('p1', { t: 'ready', ready: true });
    expect(r.status.phase).toBe('countdown');
    r.message('p1', { t: 'ready', ready: false });
    expect(r.status.phase).toBe('lobby');
    r.message('p1', { t: 'ready', ready: true });
    r.join(new Fake('late'));
    expect(r.status.phase).toBe('lobby');
    r.leave('late');
    expect(r.status.phase).toBe('countdown');
    runFor(r, 3.1);
    expect(r.status.phase).toBe('playing');
    const start = conns[1].last('start')!;
    expect(start.seats.map((s) => [s.id, s.doctor])).toEqual([['p0', 0], ['p1', 1]]);
    expect(r.game!.doctors).toHaveLength(2);
    expect(r.game!.layout.id).toBe(CONFIG.multi.ward);
  });

  it('only the host picks the year; a game in progress turns newcomers away', () => {
    const { r, conns } = room(2);
    r.message('p1', { t: 'day', day: 2 });
    expect(conns[0].last('lobby')!.lobby.day).toBe(0);
    r.message('p0', { t: 'day', day: 2 });
    expect(conns[0].last('lobby')!.lobby.day).toBe(2);
    r.message('p0', { t: 'ready', ready: true });
    r.message('p1', { t: 'ready', ready: true });
    runFor(r, 3.1);
    const late = new Fake('late');
    expect(r.join(late)).toBe(false);
    expect(late.last('error')).toEqual({ t: 'error', code: 'started' });
  });

  it('moves each doctor where his player says, acts on his presses, and snapshots the ward', () => {
    const { r, conns } = room(2);
    r.message('p0', { t: 'ready', ready: true });
    r.message('p1', { t: 'ready', ready: true });
    runFor(r, 3.1);
    const w = r.game!;
    const jar = w.layout.stations.jar.use;
    const x = jar.x + jar.w / 2;
    const y = jar.y + jar.h + 2;
    w.doctors[1].x = x;
    w.doctors[1].y = y + 4;
    r.message('p1', { t: 'move', x, y, run: false, facing: 'up', flip: false, ix: 0, iy: -1 });
    expect(w.doctors[1].y).toBeCloseTo(y);
    r.message('p1', { t: 'press' });
    expect(w.doctors[1].hand).toEqual({ kind: 'leech', count: 1 });
    runFor(r, 0.2);
    const snap = conns[0].last('snap')!;
    expect(snap.s.doctors[1].hand).toEqual({ kind: 'leech', count: 1 });
    const events = conns[0].inbox.filter((m) => m.t === 'snap').flatMap((m) => (m as Extract<ServerMsg, { t: 'snap' }>).ev);
    expect(events).toContainEqual({ kind: 'take', what: 'leech', who: 1 });
  });

  it('holding E with the bdellometer on a bed pumps him, and everyone sees who is pumping', () => {
    const { r, conns } = room(2);
    r.message('p0', { t: 'day', day: 2 }); // 1832: the bdellometer is there from eight
    for (const c of conns) r.message(c.id, { t: 'ready', ready: true });
    runFor(r, 3.1);
    const w = r.game!;
    runFor(r, 0.5); // the first men are shown to their beds
    const bed = w.beds.findIndex((b) => b.patient?.active); // the bdellometer cares nothing for a chill
    const spot = w.layout.beds[bed];
    const d = w.doctors[1];
    d.hand = { kind: 'bdello' };
    w.deviceOnStand = false;
    d.x = spot.x + 13;
    d.y = spot.y < 150 ? spot.y + 42 + 11 : spot.y - 2;
    d.facing = spot.y < 150 ? 'up' : 'down';
    const before = w.beds[bed].patient!.blood;
    r.message('p1', { t: 'pump', on: true });
    runFor(r, 1);
    expect(w.beds[bed].patient!.blood).toBeGreaterThan(before + 0.05);
    expect(conns[0].last('snap')!.s.doctors[1].pumped).toBe(bed);
    r.message('p1', { t: 'pump', on: false });
    runFor(r, 0.2);
    expect(conns[0].last('snap')!.s.doctors[1].pumped).toBeNull();
  });

  it('a player who leaves mid-game takes his doctor out of the way; the host passes on', () => {
    const { r, conns } = room(3);
    for (const c of conns) r.message(c.id, { t: 'ready', ready: true });
    runFor(r, 3.1);
    r.game!.doctors[0].hand = { kind: 'leech', count: 2 };
    const jar = r.game!.supply.jar;
    r.leave('p0');
    expect(r.game!.supply.jar).toBe(jar + 2);
    expect(conns[1].last('lobby')!.lobby.players.find((p) => p.host)!.id).toBe('p1');
  });

  it('rings the bell: the report goes out with each doctor’s credits, and the room returns to the lobby for the next year', () => {
    const { r, conns } = room(2);
    for (const c of conns) r.message(c.id, { t: 'ready', ready: true });
    runFor(r, 3.1);
    const w = r.game!;
    w.doctors[1].stats.green = 3;
    w.shift.elapsed = w.shift.spec.realSeconds - 0.05;
    runFor(r, 0.2);
    const over = conns[0].last('over')!;
    expect(over.report.credits).toEqual([
      expect.objectContaining({ slot: 0, name: 'Dr p0' }),
      expect.objectContaining({ slot: 1, name: 'Dr p1', green: 3 }),
    ]);
    expect(r.status.phase).toBe('lobby');
    expect(conns[0].last('lobby')!.lobby.day).toBe(1);
    expect(conns[0].last('lobby')!.lobby.players.every((p) => !p.ready)).toBe(true);
  });

  it('names are cleaned, and an old browser is told to reload', () => {
    expect(cleanName('  <b>Dr. Sangrado</b>!!  ', 'x')).toBe('bDr. Sangradob');
    expect(cleanName('', 'Doctor 2')).toBe('Doctor 2');
    const r = new Room('ABCD', false);
    const c = new Fake('old');
    r.join(c);
    r.message('old', { t: 'hello', name: 'x', v: PROTOCOL - 1 });
    expect(c.last('error')).toEqual({ t: 'error', code: 'version' });
  });
});

describe('snapshots', () => {
  it('a mirror ward fed snapshots draws what the server has', () => {
    const server = new Ward('snap', 1, { doctors: 2, ward: 'grandeSalle' });
    const mirror = new Ward('snap', 1, { doctors: 2, ward: 'grandeSalle' });
    const shots = new Snapshotter();
    const records = new Map<number, PatientRecord>();
    server.skipTo('machine');
    for (let i = 0; i < 300; i++) {
      server.tick(1 / 30);
      if (i % 2) applySnapshot(mirror, JSON.parse(JSON.stringify(shots.take(server))), records, 0);
    }
    const bed = server.beds.findIndex((b) => b.patient?.active);
    server.beds[bed].patient!.attach();
    server.doctors[1].hand = { kind: 'used', count: 2 };
    server.floor.push({ id: 500, x: 300, y: 200, angle: 1 });
    applySnapshot(mirror, JSON.parse(JSON.stringify(shots.take(server))), records, 0);

    expect(mirror.shift.clockText()).toBe(server.shift.clockText());
    expect(mirror.supply.jar).toBe(server.supply.jar);
    expect(mirror.deviceOnStand).toBe(server.deviceOnStand);
    expect(mirror.queue.map((q) => q.profile.name)).toEqual(server.queue.map((q) => q.profile.name));
    server.beds.forEach((b, i) => {
      expect(mirror.beds[i].patient?.profile.name).toBe(b.patient?.profile.name);
      expect(mirror.beds[i].patient?.zone()).toBe(b.patient?.zone());
    });
    expect(mirror.beds[bed].patient!.attachedCount).toBe(server.beds[bed].patient!.attachedCount);
    expect(mirror.doctors[1].hand).toEqual({ kind: 'used', count: 2 });
    expect(mirror.floor).toContainEqual({ id: 500, x: 300, y: 200, angle: 1 });
  });

  it('a man’s record goes out once; the local doctor keeps his own position unless knocked down', () => {
    const server = new Ward('snap', 0, { doctors: 2, ward: 'grandeSalle' });
    const mirror = new Ward('snap', 0, { doctors: 2, ward: 'grandeSalle' });
    const shots = new Snapshotter();
    const records = new Map<number, PatientRecord>();
    server.tick(0.1);
    const first = shots.take(server);
    const second = shots.take(server);
    expect(Object.keys(first.records).length).toBeGreaterThan(0);
    expect(Object.keys(second.records)).toHaveLength(0);
    applySnapshot(mirror, first, records, 0);
    mirror.doctors[0].x += 10; // he has walked on, ahead of the server
    const ahead = mirror.doctors[0].x;
    applySnapshot(mirror, second, records, 0);
    expect(mirror.doctors[0].x).toBe(ahead);
    server.doctors[0].dazed = 2;
    applySnapshot(mirror, shots.take(server), records, 0);
    expect(mirror.doctors[0].x).toBe(server.doctors[0].x);
  });
});
