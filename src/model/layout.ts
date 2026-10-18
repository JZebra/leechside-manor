// The Salle Saint-Côme, in art pixels (the screen shows each at PIXEL×).
// Pure numbers so the ward model, the scene and the tests share one floor plan.
//
//   wall ─ [recovery door] ─────── windows ────────────────
//          bed 0      bed 1      bed 2
//   queue
//      [jar]   [lint]   [stove]   [salt]
//               bed 3      bed 4     [bdellometer]
//                                                    drain

export interface Rect { x: number; y: number; w: number; h: number }
export type StationId = 'jar' | 'cupboard' | 'stove' | 'bucket' | 'stand' | 'door';

export const WORLD = { w: 426, h: 240, wall: 24 };
export const BED = { w: 26, h: 42 };

// Bed top-left corners.
export const BEDS: { x: number; y: number }[] = [
  { x: 137, y: 28 },
  { x: 197, y: 28 },
  { x: 257, y: 28 },
  { x: 167, y: 160 },
  { x: 227, y: 160 },
];

// Stations: the sprite's box (for drawing and reach) and its footprint (for collision).
export const STATIONS: Record<StationId, { box: Rect; foot: Rect | null; tex: string }> = {
  jar: { box: { x: 98, y: 100, w: 24, h: 30 }, foot: { x: 99, y: 116, w: 22, h: 14 }, tex: 'jar' },
  cupboard: { box: { x: 152, y: 102, w: 28, h: 26 }, foot: { x: 152, y: 114, w: 28, h: 14 }, tex: 'cupboard' },
  stove: { box: { x: 210, y: 100, w: 28, h: 30 }, foot: { x: 211, y: 116, w: 26, h: 14 }, tex: 'stove:0' },
  bucket: { box: { x: 266, y: 110, w: 20, h: 18 }, foot: { x: 267, y: 118, w: 18, h: 10 }, tex: 'bucket' },
  stand: { box: { x: 292, y: 172, w: 24, h: 28 }, foot: { x: 293, y: 188, w: 22, h: 12 }, tex: 'stand:empty' },
  door: { box: { x: 44, y: 0, w: 24, h: 30 }, foot: null, tex: 'door' },
};

export const DRAIN = { x: 392, y: 216 }; // centre of the grate
export const JAR_RIM = { x: 110, y: 104 };
export const WINDOWS = [86, 302]; // art x of the two windows in the wall

// Where the doctor's feet may go.
export const WALK = { x0: 6, y0: 34, x1: 420, y1: 236 };
export const DOCTOR_START = { x: 120, y: 88 };

export const bedRect = (i: number): Rect => ({ x: BEDS[i].x, y: BEDS[i].y, w: BED.w, h: BED.h });

export function obstacles(): Rect[] {
  const out: Rect[] = BEDS.map((_, i) => bedRect(i));
  for (const s of Object.values(STATIONS)) if (s.foot) out.push(s.foot);
  return out;
}

// Distance from a point to a rectangle's edge (0 inside).
export function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
