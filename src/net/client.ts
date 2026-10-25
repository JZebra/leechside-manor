// The browser's end of a multiplayer game: asking the server for a room, the WebSocket
// to it, and the latest lobby. One connection at a time, kept across scenes.

import { PROTOCOL, type ClientMsg, type LobbyState, type ServerMsg, type Trouble } from './protocol';

// Where the server is: set VITE_SERVER when building for itch.io (see README); on
// localhost it's the one `npm run server` starts.
export const SERVER: string | null = (() => {
  const set = import.meta.env.VITE_SERVER as string | undefined;
  if (set) return set.replace(/\/$/, '');
  return ['localhost', '127.0.0.1'].includes(location.hostname) ? `http://${location.hostname}:8787` : null;
})();

async function ask(path: string): Promise<string> {
  if (!SERVER) throw new Error('unset');
  let r: Response;
  try {
    r = await fetch(`${SERVER}${path}`, { method: 'POST' });
  } catch {
    throw new Error('unreachable');
  }
  if (!r.ok) throw new Error('unreachable');
  return ((await r.json()) as { code: string }).code;
}

export class NetClient {
  you = '';
  code = '';
  lobby: LobbyState | null = null;
  private ws: WebSocket | null = null;
  private listeners = new Set<(m: ServerMsg) => void>();
  private troubleListeners = new Set<(t: Trouble) => void>();
  private leaving = false;
  private backlog: ServerMsg[] | null = null; // kept for a scene that's about to start

  static create = () => ask('/api/create');
  static match = () => ask('/api/match');

  // Into a room: resolves once the server has let us in, rejects with the reason it didn't.
  connect(code: string, name: string): Promise<void> {
    this.code = code;
    return new Promise((resolve, reject) => {
      if (!SERVER) return reject(new Error('unset'));
      let settled = false;
      const ws = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/api/room/${code}`);
      this.ws = ws;
      ws.addEventListener('open', () => this.send({ t: 'hello', name, v: PROTOCOL }));
      ws.addEventListener('message', (e) => {
        let m: ServerMsg;
        try {
          m = JSON.parse(String(e.data)) as ServerMsg;
        } catch {
          return;
        }
        if (m.t === 'welcome') {
          this.you = m.you;
          settled = true;
          resolve();
        } else if (m.t === 'lobby') this.lobby = m.lobby;
        else if (m.t === 'error' && !settled) {
          settled = true;
          this.leaving = true;
          return reject(new Error(m.code));
        }
        this.backlog?.push(m);
        for (const fn of this.listeners) fn(m);
      });
      ws.addEventListener('close', () => {
        if (!settled) {
          settled = true;
          return reject(new Error('unreachable'));
        }
        if (!this.leaving) for (const fn of this.troubleListeners) fn('lost');
      });
    });
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  // Listen for messages; returns the way to stop (scenes call it on shutdown).
  on(fn: (m: ServerMsg) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // The doors are open: keep everything that arrives until the ward scene is listening
  // (a man's record comes only once, in the first snapshot he's in).
  hold() {
    this.backlog = [];
  }

  // …and hand it over, then listen as usual.
  release(fn: (m: ServerMsg) => void): () => void {
    const kept = this.backlog ?? [];
    this.backlog = null;
    for (const m of kept) fn(m);
    return this.on(fn);
  }

  onTrouble(fn: (t: Trouble) => void): () => void {
    this.troubleListeners.add(fn);
    return () => this.troubleListeners.delete(fn);
  }

  leave() {
    this.leaving = true;
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
    this.troubleListeners.clear();
  }
}

// The one connection, while there is one.
let current: NetClient | null = null;
export const session = {
  get: () => current,
  set: (c: NetClient | null) => {
    if (current && current !== c) current.leave();
    current = c;
  },
};

export const troubleOf = (e: unknown): Trouble => {
  const m = e instanceof Error ? e.message : '';
  return (['full', 'started', 'missing', 'version', 'lost', 'unreachable', 'unset'] as const).find((t) => t === m) ?? 'unreachable';
};
