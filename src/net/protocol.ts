// What the players' browsers and the server say to each other, as JSON over a WebSocket.
// The server runs the ward (the same model as a game alone); each browser moves its own
// doctor at once, tells the server where he is and what he presses, and draws the ward
// from the snapshots the server sends back. Shared by src/ (the game) and server/.

import type { DoctorStats, Facing, WardEvent } from '../model/ward';
import type { Entry } from '../model/shift';
import type { Snapshot } from './snapshot';

export const PROTOCOL = 1; // bump when either side changes what it sends
export const NAME_MAX = 16;
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: they read as 1 and 0
export const CODE_LENGTH = 4;

export type Phase = 'lobby' | 'countdown' | 'playing';

export interface PlayerInfo {
  id: string;
  slot: number; // 0–3: the coat colour he keeps all evening
  name: string;
  ready: boolean;
  host: boolean; // picks the year
}

export interface LobbyState {
  code: string;
  public: boolean; // found by quick match (else only by its code)
  players: PlayerInfo[];
  day: number; // index into CONFIG.days
  phase: Phase;
  countdown: number; // seconds left before the doors open
}

// One player in a game: which doctor in the model is his.
export interface Seat {
  id: string;
  doctor: number;
  slot: number;
  name: string;
}

export interface Credit extends DoctorStats {
  slot: number;
  name: string;
}

// The day's report, sent at the six o'clock bell.
export interface Report {
  day: number;
  money: number;
  verdict: 'APPROVED' | 'NOTED' | 'REPRIMAND';
  thresholds: { approved: number; noted: number };
  log: Entry[];
  applied: number;
  lost: number;
  slips: number;
  floorAtBell: number;
  credits: Credit[];
}

export type ClientMsg =
  | { t: 'hello'; name: string; v: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'day'; day: number } // the host picks the year
  | { t: 'move'; x: number; y: number; run: boolean; facing: Facing; flip: boolean; ix: number; iy: number }
  | { t: 'press' }
  | { t: 'pump'; on: boolean };

export type ErrorCode = 'full' | 'started' | 'missing' | 'version';
// …and what the browser can say for itself when it can't get in.
export type Trouble = ErrorCode | 'lost' | 'unreachable' | 'unset';

export type ServerMsg =
  | { t: 'welcome'; you: string }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; day: number; seed: string; seats: Seat[] }
  | { t: 'snap'; s: Snapshot; ev: WardEvent[] }
  | { t: 'over'; report: Report }
  | { t: 'error'; code: ErrorCode };

export function cleanName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, NAME_MAX) : '';
  return s || fallback;
}

export const isCode = (s: string) => s.length === CODE_LENGTH && [...s].every((c) => CODE_LETTERS.includes(c));
