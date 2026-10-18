// A tiny pixel-art buffer, ported from Thirty Leeches (src/ui/pixel/canvas.js).
// Every pixel holds a palette key or null, so nothing off-palette can be drawn.
// Sprites build a Pix, render it to a 1:1 canvas, and Phaser shows it at PIXEL×
// with nearest-neighbour filtering — one grid for every sprite.

import { PALETTE, type PaletteKey } from './palette';

type Px = PaletteKey | null;
type Only = (x: number, y: number, c: Px) => boolean;

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly d: Px[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(null);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Px {
    return this.inside(x, y) ? this.d[y * this.w + x] : null;
  }

  set(x: number, y: number, c: Px): this {
    x = Math.round(x);
    y = Math.round(y);
    if (c != null && !(c in PALETTE)) throw new Error(`Not a palette colour: ${c}`);
    if (this.inside(x, y)) this.d[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Px): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  // Filled ellipse, tested at pixel centres; angle in radians.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Px, opts: { angle?: number; only?: Only } = {}): this {
    const { angle = 0, only } = opts;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = Math.ceil(Math.max(rx, ry)) + 1;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const u = (dx * cos + dy * sin) / rx;
        const v = (-dx * sin + dy * cos) / ry;
        if (u * u + v * v <= 1 && (!only || only(x, y, this.get(x, y)))) this.set(x, y, c);
      }
    }
    return this;
  }

  // Bresenham line.
  line(x0: number, y0: number, x1: number, y1: number, c: Px): this {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  // Filled polygon (even-odd), sampled at pixel centres.
  poly(points: [number, number][], c: Px): this {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  // Repaint pixels: fn returns a new colour, or undefined to keep.
  map(fn: (x: number, y: number, c: Px) => Px | undefined): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = fn(x, y, this.get(x, y));
        if (v !== undefined) this.set(x, y, v);
      }
    }
    return this;
  }

  // Outer outline: empty pixels touching (4-way) a filled one become c.
  outline(c: PaletteKey): this {
    const filled = this.d.map((v) => v != null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (filled[y * this.w + x]) continue;
        const near = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(
          ([dx, dy]) => this.inside(x + dx, y + dy) && filled[(y + dy) * this.w + x + dx]);
        if (near) this.set(x, y, c);
      }
    }
    return this;
  }

  // Checkerboard of c over a rectangle.
  dither(x: number, y: number, w: number, h: number, c: Px, opts: { only?: Only; phase?: number } = {}): this {
    const { only, phase = 0 } = opts;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if ((i + j + phase) % 2 === 0 && (!only || only(i, j, this.get(i, j)))) this.set(i, j, c);
      }
    }
    return this;
  }

  // Paint c wherever `shape` is filled and `only` accepts the current pixel.
  stamp(shape: Pix, c: Px, only?: Only): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (shape.get(x, y) != null && (!only || only(x, y, this.get(x, y)))) this.set(x, y, c);
    }
    return this;
  }

  // Copy another Pix's filled pixels onto this one.
  blit(src: Pix, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const v = src.get(x, y);
      if (v != null) this.set(x + ox, y + oy, v);
    }
    return this;
  }

  // A 1:1 canvas (one canvas pixel per art pixel) for Phaser's texture manager.
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.d[y * this.w + x];
        if (v == null) continue;
        ctx.fillStyle = PALETTE[v];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }
}

// 3×5 digits for counts drawn inside sprites.
const GLYPHS: Record<string, string[]> = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
};

export const textWidth = (text: string): number => text.length * 4 - 1;

export function digits(pix: Pix, text: string, x: number, y: number, c: PaletteKey): Pix {
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, j) => [...row].forEach((b, k) => b === '#' && pix.set(x + i * 4 + k, y + j, c)));
  });
  return pix;
}
