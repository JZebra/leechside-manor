// The wards, in art pixels (the screen shows each at PIXEL×). Pure numbers so the
// ward model, the scene, the sim and the tests share one floor plan.
//
// Salle Saint-Côme (day 1)                Salle Saint-Louis (days 2–3)
//   wall ─ [recovery door] ── windows      wall ─ [recovery door] ── windows
//          bed bed bed                  ⟶ orderlies ⟶ bed bed bed bed ⟶
//     [jar] [cupb] [stove] [salt]           [jar] [cupb] [stove] [salt]
//            bed bed   [bdellometer]    ⟵ orderlies ⟵ bed bed bed  [bdellometer]
//                               drain                                  drain
//
// Grande Salle (playing together): half as big again each way, six beds along each wall,
// one of each station spread down the middle so the doctors cross each other's paths.

import type { WardId } from '../config';
import { WARD_NAME } from '../data/lines';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export type StationId = 'jar' | 'cupboard' | 'stove' | 'bucket' | 'stand' | 'door';

export interface Station {
  box: Rect; // the sprite (drawing, depth)
  foot: Rect | null; // what the doctor bumps into
  use: Rect; // what he reaches for: the base, not the top of the sprite behind it
  tex: string;
}

export interface Layout {
  id: WardId;
  name: string;
  world: { w: number; h: number; wall: number }; // the room in art px (the camera fits it to the screen)
  beds: Point[]; // top-left corners
  stations: Record<StationId, Station>;
  drain: Point;
  jarRim: Point;
  windows: number[];
  walk: { x0: number; y0: number; x1: number; y1: number }; // where the doctor's feet may go
  starts: Point[]; // where each doctor begins, one per player
  routes: Point[][]; // orderlies walk these, end to end
}

export const WORLD = { w: 426, h: 240, wall: 24 }; // the one-doctor wards: the stage at PIXEL×
const GRAND = { w: 640, h: 360, wall: 24 }; // the stage at two-thirds of PIXEL×
export const BED = { w: 26, h: 42 };
// The doctor can't stand right against a bed's foot: with this margin his head stays
// below the patient's chest, so the leeches on it are never hidden behind him.
export const FOOTBOARD = 8;

function station(box: Rect, footH: number | null, tex: string): Station {
  const foot = footH == null ? null : { x: box.x + 1, y: box.y + box.h - footH, w: box.w - 2, h: footH };
  const base = foot ?? { x: box.x, y: box.y + box.h - 8, w: box.w, h: 8 };
  return { box, foot, use: { x: base.x - 1, y: base.y - 2, w: base.w + 2, h: base.h + 3 }, tex };
}

const ISLAND: Omit<Record<StationId, Station>, 'stand'> = {
  jar: station({ x: 98, y: 100, w: 24, h: 30 }, 14, 'jar'),
  cupboard: station({ x: 152, y: 102, w: 28, h: 26 }, 14, 'cupboard'),
  stove: station({ x: 210, y: 100, w: 28, h: 30 }, 14, 'stove:0'),
  bucket: station({ x: 266, y: 110, w: 20, h: 18 }, 10, 'bucket'),
  door: station({ x: 44, y: 0, w: 24, h: 30 }, null, 'door'),
};

export const LAYOUTS: Record<WardId, Layout> = {
  saintCome: {
    id: 'saintCome',
    name: WARD_NAME.saintCome,
    world: WORLD,
    beds: [
      { x: 137, y: 28 },
      { x: 197, y: 28 },
      { x: 257, y: 28 },
      { x: 167, y: 160 },
      { x: 227, y: 160 },
    ],
    stations: { ...ISLAND, stand: station({ x: 292, y: 172, w: 24, h: 28 }, 12, 'stand:empty') },
    drain: { x: 392, y: 216 },
    jarRim: { x: 110, y: 104 },
    windows: [86, 302],
    walk: { x0: 6, y0: 34, x1: 420, y1: 236 },
    starts: [{ x: 120, y: 88 }, { x: 330, y: 88 }, { x: 120, y: 150 }, { x: 330, y: 150 }],
    routes: [],
  },
  saintLouis: {
    id: 'saintLouis',
    name: WARD_NAME.saintLouis,
    world: WORLD,
    beds: [
      { x: 112, y: 28 },
      { x: 170, y: 28 },
      { x: 228, y: 28 },
      { x: 286, y: 28 },
      { x: 141, y: 162 },
      { x: 199, y: 162 },
      { x: 257, y: 162 },
    ],
    stations: { ...ISLAND, stand: station({ x: 318, y: 174, w: 24, h: 28 }, 12, 'stand:empty') },
    drain: { x: 396, y: 222 },
    jarRim: { x: 110, y: 104 },
    windows: [350, 386],
    walk: { x0: 6, y0: 34, x1: 420, y1: 236 },
    starts: [{ x: 88, y: 122 }, { x: 360, y: 122 }, { x: 60, y: 200 }, { x: 380, y: 200 }], // clear of the orderlies' aisles
    // the top aisle runs left to right; the other route sweeps the lower aisle right to left
    routes: [
      [{ x: -12, y: 91 }, { x: 438, y: 91 }],
      [{ x: 438, y: 147 }, { x: -12, y: 147 }],
    ],
  },
  grandeSalle: {
    id: 'grandeSalle',
    name: WARD_NAME.grandeSalle,
    world: GRAND,
    beds: [
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ x: 120 + i * 70, y: 28 })),
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ x: 155 + i * 70, y: 270 })),
    ],
    stations: {
      jar: station({ x: 150, y: 150, w: 24, h: 30 }, 14, 'jar'),
      cupboard: station({ x: 262, y: 152, w: 28, h: 26 }, 14, 'cupboard'),
      stove: station({ x: 378, y: 150, w: 28, h: 30 }, 14, 'stove:0'),
      bucket: station({ x: 494, y: 160, w: 20, h: 18 }, 10, 'bucket'),
      door: ISLAND.door,
      stand: station({ x: 590, y: 282, w: 24, h: 28 }, 12, 'stand:empty'),
    },
    drain: { x: 614, y: 348 },
    jarRim: { x: 162, y: 154 },
    windows: [540, 590],
    walk: { x0: 6, y0: 34, x1: 634, y1: 356 },
    starts: [{ x: 104, y: 140 }, { x: 560, y: 140 }, { x: 104, y: 236 }, { x: 560, y: 236 }],
    routes: [
      [{ x: -12, y: 112 }, { x: 652, y: 112 }],
      [{ x: 652, y: 228 }, { x: -12, y: 228 }],
    ],
  },
};

export const bedRectOf = (layout: Layout, i: number): Rect => ({ x: layout.beds[i].x, y: layout.beds[i].y, w: BED.w, h: BED.h });

export function obstaclesOf(layout: Layout): Rect[] {
  const out: Rect[] = layout.beds.map((_, i) => ({ ...bedRectOf(layout, i), h: BED.h + FOOTBOARD }));
  for (const s of Object.values(layout.stations)) if (s.foot) out.push(s.foot);
  return out;
}

// Distance from a point to a rectangle's edge (0 inside).
export function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

// The point of a rectangle nearest to (px, py).
export function nearestOn(px: number, py: number, r: Rect): Point {
  return { x: Math.max(r.x, Math.min(px, r.x + r.w)), y: Math.max(r.y, Math.min(py, r.y + r.h)) };
}

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
