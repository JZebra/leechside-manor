// Every sprite in the ward, drawn procedurally into palette-locked Pix buffers
// (the Thirty Leeches way) and registered as Phaser textures. One texture pixel =
// one art pixel; the game shows them at PIXEL×.

import Phaser from 'phaser';
import { Pix } from './pix';
import { SKIN, HAIR, PALLOR_LADDER, type PaletteKey, type Ramp } from './palette';

// ── Leeches ──────────────────────────────────────────────────────────────────
// Hirudo medicinalis, drawn pixel by pixel along a bending spine: a ringed,
// glistening body that bloats as it feeds, two rusty stripes, a crown of tiny red
// eyes (they really have ten), and a mouth of three toothed jaws.

export interface LeechShape {
  cx: number;
  cy: number;
  angle: number; // 0 = head up
  length: number; // art px, head to tail
  girth: number; // widest half-width
  bend?: number; // a C-curve: sideways bow at the middle
  wave?: number; // an S-curve: writhing
  fed?: number; // 0 hungry … 1 gorged
  mouth?: 'shut' | 'open';
  eyes?: boolean;
}

// Half-width along the body, head (0) to tail (1): a narrow head, a swollen
// middle, and the round sucker it clings with at the back.
function profile(t: number): number {
  if (t < 0.16) return 0.32 + 0.5 * (t / 0.16);
  if (t < 0.8) return 0.82 + 0.18 * Math.sin((Math.PI * (t - 0.16)) / 0.64);
  return 0.18 + 0.68 * Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2));
}

export function drawLeech(pix: Pix, s: LeechShape) {
  const N = 40;
  const ux = Math.sin(s.angle);
  const uy = -Math.cos(s.angle);
  const fed = s.fed ?? 0;
  const spine = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const along = (0.5 - t) * s.length;
    const side = (s.bend ?? 0) * Math.sin(Math.PI * t) + (s.wave ?? 0) * Math.sin(2 * Math.PI * t);
    return { t, x: s.cx + ux * along - uy * side, y: s.cy + uy * along + ux * side };
  });
  const tangent = (i: number) => {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(N - 1, i + 1)];
    const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return { x: (a.x - b.x) / l, y: (a.y - b.y) / l }; // headwards
  };
  const hungry = fed < 0.5;
  const base: PaletteKey = hungry ? 'leech1' : 'red0';
  const dark: PaletteKey = hungry ? 'leech0' : 'leech1';
  const rim: PaletteKey = hungry ? 'leech2' : 'red1';
  const stripe: PaletteKey = hungry ? 'leechStripe' : 'red2';
  const r = Math.ceil(s.length / 2 + s.girth + Math.abs(s.bend ?? 0) + Math.abs(s.wave ?? 0)) + 1;
  for (let y = Math.floor(s.cy - r); y <= s.cy + r; y++) {
    for (let x = Math.floor(s.cx - r); x <= s.cx + r; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let best = Infinity;
      let bi = 0;
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(px - spine[i].x, py - spine[i].y);
        if (d < best) { best = d; bi = i; }
      }
      const t = spine[bi].t;
      const w = s.girth * profile(t);
      if (best > w) continue;
      const tg = tangent(bi);
      const sn = ((tg.x * (py - spine[bi].y) - tg.y * (px - spine[bi].x)) / Math.max(w, 0.5)); // −1 … 1 across
      const ring = (t * s.length) / 1.4; // the annuli
      let c: PaletteKey = base;
      if (sn > 0.45) c = dark; // the belly side, in shadow
      else if (sn < -0.55) c = rim;
      if (ring % 1 < 0.38 && Math.abs(sn) < 0.8) c = dark; // ridges between the rings
      if (s.length >= 9 && Math.abs(Math.abs(sn) - 0.36) < 0.2 && Math.floor(ring) % 2 === 0 && t > 0.12 && t < 0.86) c = stripe;
      if (!hungry && Math.floor(ring) % 3 === 1 && Math.abs(sn) < 0.25) c = 'red2'; // blood showing through
      if (sn < -0.25 && (x * 7 + y * 5) % 7 === 0) c = hungry ? 'leechGloss' : 'red3'; // wet glints along the back
      pix.set(x, y, c);
    }
  }
  // the head: a crown of little red eyes, and the mouth
  if (s.eyes !== false) {
    for (const t of [0.06, 0.13]) {
      const i = Math.round(t * (N - 1));
      const tg = tangent(i);
      const w = s.girth * profile(t) * 0.55;
      pix.set(Math.floor(spine[i].x - tg.y * w), Math.floor(spine[i].y + tg.x * w), 'red3');
      pix.set(Math.floor(spine[i].x + tg.y * w), Math.floor(spine[i].y - tg.x * w), 'red3');
    }
  }
  const tip = spine[0];
  const tg = tangent(0);
  const mx = Math.floor(tip.x + tg.x * 0.6);
  const my = Math.floor(tip.y + tg.y * 0.6);
  pix.set(mx, my, 'ink');
  if (s.mouth === 'open') {
    // three jaws in a Y, each with a fringe of teeth
    pix.set(Math.round(mx + tg.x), Math.round(my + tg.y), 'linen0');
    pix.set(Math.round(mx - tg.y), Math.round(my + tg.x), 'linen0');
    pix.set(Math.round(mx + tg.y), Math.round(my - tg.x), 'linen0');
  }
}

function leech(shape: Omit<LeechShape, 'cx' | 'cy'>, size = 13, blood = false) {
  const p = new Pix(size, size);
  drawLeech(p, { ...shape, cx: size / 2, cy: size / 2 });
  if (blood) p.set(Math.floor(size / 2) + 3, Math.floor(size / 2) + 3, 'red3').set(Math.floor(size / 2) + 4, Math.floor(size / 2) + 3, 'red2');
  return p.outline('ink');
}

// Feeding on a chest: four stages of bloat, two of throb (the body pulses as it sucks).
export const SATED = 3;
const attached = (frame: number, pulse: number) =>
  leech({ angle: 0.35, length: 7.5 + frame * 0.9, girth: 1.4 + frame * 0.5 + pulse * 0.35, fed: frame / SATED, mouth: 'shut', eyes: false }, 13);

// Held up in the doctor's fist: writhing, mouths open.
const writhing = (wave: number, angle: number) => leech({ angle, length: 11, girth: 1.9, wave, mouth: 'open' }, 15);

// ── People ───────────────────────────────────────────────────────────────────

export interface PatientLook {
  skin: string; // 'A' | 'B' | 'C'
  hair: string;
  moustache: boolean;
  build: 'normal' | 'thin' | 'small';
  pallor: number; // 0–3
  eyes: 'open' | 'closed' | 'wide';
  sweat: boolean;
  cold: boolean; // blanket to the chin, blue lips
}

export const PATIENT_W = 22;
export const PATIENT_H = 36;
// Where leeches go (art px within the patient sprite): left chest, epigastrium, right chest.
export const LEECH_SLOTS: [number, number][] = [[7, 17], [11, 20], [15, 17]];

// A man in bed seen from above: head on the pillow, shirt open, army blanket to the waist.
function patient(look: PatientLook) {
  const p = new Pix(PATIENT_W, PATIENT_H);
  const S: Ramp = SKIN[PALLOR_LADDER[look.pallor] ?? look.skin] ?? SKIN.B;
  const H: Ramp = HAIR[look.hair] ?? HAIR.hairDark;
  const small = look.build === 'small';
  const half = look.build === 'thin' || small ? 6 : 8;
  const cx = 11;
  const headY = small ? 8 : 7;
  const r = small ? 3.8 : 4.5;

  // shoulders and arms in shirtsleeves
  p.ellipse(cx, 16, half + 2.5, 5, 'linen1');
  p.rect(cx - half - 2, 14, 3, 10, 'linen1');
  p.rect(cx + half, 14, 3, 10, 'linen1');
  p.rect(cx - half - 2, 23, 3, 2, S[1]); // hands
  p.rect(cx + half, 23, 3, 2, S[1]);
  // bare chest where the shirt is open
  p.poly([[cx - half + 1, 13], [cx + half - 1, 13], [cx + half - 1, 25], [cx - half + 1, 25]], S[1]);
  p.rect(cx + 2, 13, half - 3, 12, S[2]);
  p.dither(cx, 13, 2, 12, S[2]);
  p.line(cx - 3, 13, cx, 16, 'linen0').line(cx + 3, 13, cx, 16, 'linen0'); // open collar
  // army blanket: grey wool with a red stripe, from the waist down — or, if he's
  // chilled, hauled up to the chin over his chest and arms
  const top = look.cold ? 12 : 24;
  p.rect(1, top, 20, 36 - top, 'slate2');
  p.rect(1, top, 20, 1, 'slate1');
  p.rect(1, top + 4, 20, 2, 'red1');
  p.dither(13, top + 1, 8, 35 - top, 'slate1');
  if (look.cold) {
    p.rect(cx - half - 1, top - 1, 3, 2, S[1]).rect(cx + half - 1, top - 1, 3, 2, S[1]); // fists clutching the edge
    p.dither(2, top + 7, 18, 10, 'slate1', { phase: 1 }); // rucked-up folds
  }
  // head on the pillow
  p.ellipse(cx, headY, r, r + 0.6, S[1]);
  p.dither(cx + 1, headY - 4, 4, 9, S[2], { only: (x, y, c) => c === S[1] });
  p.ellipse(cx, headY - r * 0.6, r + 0.3, r * 0.55, H[1], { only: (x, y) => y < headY - 1 }); // crown of hair
  p.rect(cx - Math.round(r), headY - 2, 1, 3, H[1]); // sideburns
  p.rect(cx + Math.round(r) - 1, headY - 2, 1, 3, H[1]);
  // face
  const ey = headY;
  if (look.eyes === 'open') {
    p.set(cx - 2, ey, 'ink').set(cx + 1, ey, 'ink');
  } else if (look.eyes === 'wide') {
    p.rect(cx - 3, ey - 1, 2, 2, 'linen0').rect(cx + 1, ey - 1, 2, 2, 'linen0');
    p.set(cx - 2, ey, 'ink').set(cx + 1, ey, 'ink');
  } else {
    p.rect(cx - 3, ey, 2, 1, S[3]).rect(cx + 1, ey, 2, 1, S[3]);
  }
  if (look.pallor >= 2) p.rect(cx - 3, ey + 1, 2, 1, S[2]).rect(cx + 1, ey + 1, 2, 1, S[2]); // shadows under the eyes
  const mouthY = headY + Math.round(r) - 1;
  p.rect(cx - 1, mouthY, 2, 1, look.cold ? 'blue0' : look.pallor >= 2 ? S[3] : 'red1');
  if (look.cold) p.set(cx - 2, mouthY, 'blue1').set(cx + 1, mouthY, 'blue1'); // chattering, blue-lipped
  if (look.moustache && !small) p.rect(cx - 2, mouthY - 1, 4, 1, H[1]);
  if (look.sweat) p.set(cx - r - 1, headY - 2, 'blue1').set(cx + r + 1, headY - 1, 'blue1').set(cx + r + 1, headY, 'blue0');
  return p.outline('ink');
}

export const PATIENT_TEX = (look: PatientLook) =>
  `pt:${look.skin}:${look.hair}:${look.moustache ? 1 : 0}:${look.build}:${look.pallor}:${look.eyes}:${look.sweat ? 1 : 0}:${look.cold ? 1 : 0}`;

export function ensurePatientTexture(scene: Phaser.Scene, look: PatientLook): string {
  const key = PATIENT_TEX(look);
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, patient(look).canvas());
  return key;
}

// The house physician: black coat, cravat, a butcher's apron. Four facings, two steps.
type Facing = 'down' | 'up' | 'side';
function doctor(facing: Facing, step: number) {
  const p = new Pix(14, 24);
  const cx = 7;
  // legs
  const l = step === 1 ? -1 : 0;
  const rr = step === 1 ? 1 : 0;
  if (facing === 'side') {
    p.rect(cx - 2 + l, 19, 2, 4, 'ink').rect(cx + 1 + rr, 19, 2, 4, 'ink1');
  } else {
    p.rect(cx - 3, 19 + l, 2, 4, 'ink').rect(cx + 1, 19 - rr, 2, 4, 'ink');
  }
  // coat
  p.poly([[cx - 5, 10], [cx + 5, 10], [cx + 6, 20], [cx - 6, 20]], 'ink1');
  p.rect(cx + 2, 11, 4, 9, 'ink');
  if (facing === 'down') {
    // apron with a blood smear, cravat
    p.rect(cx - 3, 12, 7, 8, 'linen1');
    p.rect(cx - 3, 12, 7, 1, 'linen0');
    p.set(cx + 1, 16, 'red2').set(cx + 2, 17, 'red1').set(cx, 18, 'red2');
    p.rect(cx - 1, 9, 3, 2, 'linen0');
  } else if (facing === 'side') {
    p.rect(cx + 2, 12, 2, 8, 'linen1');
    p.rect(cx + 2, 9, 2, 2, 'linen0');
  } else {
    p.rect(cx - 1, 11, 3, 1, 'linen1'); // apron strings
  }
  // head
  p.ellipse(cx + 0.5, 5, 4, 4.5, 'skinB1');
  p.ellipse(cx + 0.5, 3, 4.3, 2.6, 'hairDark', { only: (x, y) => y < 4 });
  if (facing === 'down') {
    p.set(cx - 1, 5, 'ink').set(cx + 2, 5, 'ink');
    p.rect(cx - 3, 3, 1, 4, 'hairDark').rect(cx + 4, 3, 1, 4, 'hairDark'); // side-whiskers
    p.set(cx, 7, 'skinB2').set(cx + 1, 7, 'skinB2');
  } else if (facing === 'side') {
    p.set(cx + 3, 5, 'ink');
    p.rect(cx - 3, 2, 3, 6, 'hairDark');
    p.set(cx + 5, 6, 'skinB1');
  } else {
    p.ellipse(cx + 0.5, 4.5, 4, 4, 'hairDark');
  }
  return p.outline('ink');
}

// Flat on his back after a slip, seen from above: legs one way, head the other.
function doctorFallen() {
  const p = new Pix(26, 12);
  p.rect(1, 4, 7, 2, 'ink').rect(1, 7, 7, 2, 'ink'); // legs
  p.poly([[8, 2], [19, 2], [20, 10], [8, 10]], 'ink1'); // coat
  p.rect(10, 4, 7, 4, 'linen1'); // apron
  p.set(13, 5, 'red2').set(14, 6, 'red1');
  p.rect(17, 0, 3, 3, 'skinB1').rect(17, 9, 3, 3, 'skinB1'); // arms flung out
  p.ellipse(22, 6, 3.5, 3.6, 'skinB1'); // head
  p.ellipse(23.5, 6, 2, 3.6, 'hairDark', { only: (x) => x > 23 });
  p.set(21, 5, 'ink').set(21, 7, 'ink'); // eyes, rolled
  return p.outline('ink');
}

// Stars wheeling round a dazed head.
function daze(phase: number) {
  const p = new Pix(15, 6);
  const star = (x: number, y: number, c: PaletteKey) => p.set(x, y, c).set(x - 1, y, c).set(x + 1, y, c).set(x, y - 1, c).set(x, y + 1, c);
  if (phase) { star(2, 3, 'brass2'); star(8, 1, 'paper0'); star(13, 4, 'brass2'); }
  else { star(4, 1, 'paper0'); star(10, 4, 'brass2'); star(13, 1, 'paper0'); }
  return p;
}

// An orderly: grey smock, white cap, carrying his load across the ward. Side view, two steps.
function orderly(step: number, load: number) {
  const p = new Pix(18, 25);
  const cx = 8;
  const l = step ? -1 : 0;
  p.rect(cx - 2 + l, 20, 2, 4, 'wood1').rect(cx + 1 - l, 20, 2, 4, 'wood0'); // legs
  p.poly([[cx - 4, 10], [cx + 4, 10], [cx + 5, 21], [cx - 5, 21]], 'slate2'); // smock
  p.rect(cx - 4, 10, 2, 11, 'slate1');
  p.ellipse(cx + 0.5, 6, 3.6, 4, 'skinC1'); // head
  p.rect(cx - 3, 1, 7, 3, 'linen0'); // cap
  p.set(cx + 3, 6, 'ink');
  // the load, held out in front
  if (load === 0) { // a basket of soiled linen
    p.rect(cx + 2, 12, 8, 6, 'wood3').rect(cx + 2, 12, 8, 1, 'wood4');
    p.rect(cx + 3, 10, 6, 2, 'linen1').set(cx + 5, 11, 'red1');
  } else if (load === 1) { // a slop pail
    p.rect(cx + 3, 12, 6, 7, 'slate1').rect(cx + 3, 12, 6, 1, 'slate2');
    p.rect(cx + 4, 13, 4, 1, 'brass0');
  } else { // a pile of blankets
    p.rect(cx + 2, 11, 8, 6, 'slate2').rect(cx + 2, 13, 8, 1, 'red1').rect(cx + 2, 15, 8, 1, 'slate1');
  }
  p.rect(cx + 1, 13, 2, 2, 'skinC1'); // hands
  return p.outline('ink');
}

// ── Items carried or lying about ────────────────────────────────────────────

function lint() {
  const p = new Pix(13, 11);
  p.ellipse(5, 6, 4.5, 3.6, 'linen0');
  p.ellipse(5, 6, 2, 1.6, 'linen1');
  p.ellipse(5, 6, 0.8, 0.8, 'paper3');
  p.rect(8, 6, 4, 4, 'brass0'); // a cake of amadou
  p.rect(8, 6, 4, 1, 'wood3');
  return p.outline('ink');
}

function sugarWater() {
  const p = new Pix(13, 12);
  p.ellipse(6.5, 8, 5.5, 3, 'wood3');
  p.ellipse(6.5, 7, 4.5, 1.8, 'glass1');
  p.ellipse(6.5, 7, 2, 0.8, 'linen0');
  p.set(4, 3, 'paper0').set(5, 2, 'paper0').set(8, 3, 'paper0').set(9, 1, 'paper0'); // steam
  return p.outline('ink');
}

function bdellometer(stroke = 0, fill = 0) {
  const p = new Pix(13, 19);
  const top = stroke ? 3 : 1;
  p.rect(2, top, 9, 2, 'brass0'); // T-handle
  p.rect(5, top + 2, 3, 7 - top, 'brass1'); // rod
  p.rect(3, 7, 7, 6, 'brass1'); // pump barrel
  p.rect(3, 7, 2, 6, 'brass2');
  p.rect(3, 9, 7, 1, 'brass0');
  p.ellipse(6.5, 15.5, 4.5, 3, 'glass2'); // glass cup
  if (fill > 0) p.ellipse(6.5, 16.5, 4 * fill + 0.5, 2 * fill + 0.3, 'red2');
  p.set(4, 14, 'linen0');
  return p.outline('ink');
}

// Carried crosswise in front of the doctor: poles, canvas, a man white as wax.
// The bdellometer at work on a chest: the glass cup filling red, the barrel's piston stroking.
function cupOnChest(stroke: number, fill: number) {
  const p = new Pix(13, 15);
  const top = stroke ? 2 : 0;
  p.rect(5, top, 3, 6 - top, 'brass2'); // piston rod
  p.rect(3, 4, 7, 5, 'brass1'); // barrel
  p.rect(3, 4, 2, 5, 'brass2');
  p.rect(3, 6, 7, 1, 'brass0');
  p.ellipse(6.5, 11, 5, 3.2, 'glass2'); // the cup over the scarified skin
  if (fill > 0) p.ellipse(6.5, 12, 4.4 * fill + 0.5, 2.2 * fill + 0.3, 'red2');
  p.set(4, 10, 'linen0');
  return p.outline('ink');
}

function stretcher() {
  const p = new Pix(34, 14);
  p.rect(0, 2, 34, 1, 'wood3').rect(0, 11, 34, 1, 'wood3');
  p.rect(3, 3, 28, 8, 'linen1');
  p.ellipse(8, 7, 3.6, 3.2, 'wax1');
  p.rect(7, 5, 1, 2, 'wax3').rect(7, 8, 1, 2, 'wax3'); // closed eyes, seen sideways
  p.rect(12, 3, 18, 8, 'slate2');
  p.rect(17, 3, 2, 8, 'red1');
  p.rect(12, 9, 18, 2, 'slate1');
  return p.outline('ink');
}

// Speech-bubble icons over a bed.
function bubble(draw: (p: Pix) => void, ink: PaletteKey = 'paper0') {
  const p = new Pix(12, 13);
  p.rect(0, 0, 12, 10, ink);
  p.rect(2, 10, 2, 1, ink).set(2, 11, ink);
  draw(p);
  return p.outline('ink');
}
const ICONS: Record<string, () => Pix> = {
  'icon:ready': () => bubble((p) => {
    p.ellipse(6, 5, 3.6, 3, 'linen1');
    p.ellipse(6, 5, 1.4, 1.2, 'paper3');
  }, 'meterGreen1'),
  'icon:warn': () => bubble((p) => { p.rect(5, 2, 2, 4, 'red2'); p.rect(5, 7, 2, 1, 'red2'); }),
  // chilled: a snowflake in a cold blue bubble
  'icon:cold': () => bubble((p) => {
    p.rect(5, 1, 2, 8, 'linen0').rect(2, 4, 8, 2, 'linen0');
    p.set(3, 2, 'linen0').set(8, 2, 'linen0').set(3, 7, 'linen0').set(8, 7, 'linen0');
  }, 'meterBlue'),
  'icon:faint': () => bubble((p) => {
    p.rect(1, 3, 10, 1, 'wood3').rect(1, 7, 10, 1, 'wood3');
    p.rect(2, 4, 8, 3, 'linen1');
    p.ellipse(3.5, 5.5, 1.6, 1.4, 'wax2');
  }, 'meterBlue1'),
  'icon:warm': () => {
    const p = new Pix(9, 7);
    for (const x of [1, 4, 7]) p.set(x, 5, 'copper2').set(x + 1, 4, 'copper2').set(x, 3, 'copper2').set(x + 1, 2, 'copper2').set(x, 1, 'copper2');
    return p;
  },
  'icon:panic': () => {
    const p = new Pix(5, 9);
    p.rect(1, 0, 3, 5, 'red3').rect(1, 6, 3, 2, 'red3');
    return p.outline('ink');
  },
};

// A checkerboard of ink: dims the ward behind a note without any transparency.
function dither() {
  return new Pix(2, 2).set(0, 0, 'ink').set(1, 1, 'ink');
}

// ── Stations ────────────────────────────────────────────────────────────────

function jar() {
  const p = new Pix(24, 30);
  p.ellipse(12, 18, 10.5, 11, 'paper3'); // stoneware crock
  p.rect(4, 6, 16, 12, 'paper3');
  p.dither(14, 6, 7, 22, 'paper4', { only: (x, y, c) => c === 'paper3' });
  p.ellipse(12, 6, 8, 2.5, 'water0'); // river water at the mouth
  p.ellipse(12, 6, 6, 1.5, 'water1');
  p.rect(4, 3, 16, 2, 'linen1'); // muslin tied over the top
  p.rect(4, 5, 16, 1, 'wood3');
  p.rect(6, 13, 12, 9, 'paper0'); // label (the count is written on it)
  p.rect(6, 13, 12, 1, 'paper2');
  return p.outline('ink');
}

function bucket() {
  const p = new Pix(20, 18);
  p.poly([[2, 5], [18, 5], [16, 17], [4, 17]], 'wood3');
  p.rect(2, 8, 16, 1, 'slate1').rect(3, 14, 14, 1, 'slate1'); // iron hoops
  p.ellipse(10, 5, 8, 2.6, 'linen1'); // salt heap
  p.ellipse(9, 4, 5, 1.6, 'linen0');
  p.dither(4, 5, 12, 12, 'wood2', { only: (x, y, c) => c === 'wood3' && x > 11 });
  return p.outline('ink');
}

function cupboard() {
  const p = new Pix(28, 26);
  p.rect(1, 1, 26, 24, 'wood3');
  p.rect(3, 3, 22, 9, 'wood1').rect(3, 14, 22, 9, 'wood1');
  // shelves of lint rolls and amadou cakes
  for (const [x, y] of [[5, 6], [10, 6], [15, 6], [5, 17], [10, 17]] as [number, number][]) {
    p.ellipse(x + 1.5, y + 1.5, 2.2, 2.2, 'linen0');
    p.set(x + 1, y + 1, 'linen1');
  }
  p.rect(18, 17, 5, 4, 'brass0').rect(18, 17, 5, 1, 'wood3');
  p.rect(20, 5, 4, 5, 'brass0');
  p.rect(1, 1, 26, 1, 'wood4');
  return p.outline('ink');
}

function stove(steam: number) {
  const p = new Pix(28, 30);
  p.rect(2, 12, 24, 16, 'slate0'); // iron stove
  p.rect(2, 12, 24, 2, 'slate2');
  p.rect(6, 18, 16, 7, 'ink');
  p.rect(8, 20, 12, 3, steam % 2 ? 'red3' : 'red2'); // fire in the grate
  p.ellipse(14, 10, 7, 4.5, 'copper1'); // copper kettle
  p.ellipse(12, 9, 4, 2.2, 'copper2');
  p.rect(20, 7, 4, 2, 'copper0'); // spout
  p.rect(12, 3, 4, 2, 'copper0');
  const s = steam % 2;
  p.set(24, 5 - s, 'paper0').set(25, 3 - s, 'paper0').set(24, 1, 'paper0');
  return p.outline('ink');
}

function stand(withDevice: boolean) {
  const p = new Pix(24, 28);
  p.rect(2, 14, 20, 4, 'wood3'); // little table
  p.rect(2, 14, 20, 1, 'wood4');
  p.rect(3, 18, 2, 9, 'wood2').rect(19, 18, 2, 9, 'wood2');
  if (withDevice) p.blit(bdellometer(), 6, 0);
  else p.ellipse(12, 15, 5, 1.2, 'wood2'); // a ring where it stood
  return p.outline('ink');
}

function door() {
  const p = new Pix(24, 30);
  p.rect(0, 0, 24, 30, 'wood1'); // frame set in the wall
  p.rect(2, 2, 20, 28, 'wood2');
  p.rect(3, 4, 8, 25, 'wood3').rect(13, 4, 8, 25, 'wood3');
  p.rect(11, 2, 2, 28, 'wood1');
  p.rect(4, 6, 6, 8, 'wood2').rect(14, 6, 6, 8, 'wood2'); // panels
  p.set(10, 18, 'brass2').set(13, 18, 'brass2');
  return p.outline('ink');
}

function drain() {
  const p = new Pix(12, 8);
  p.rect(0, 0, 12, 8, 'slate1');
  for (let x = 1; x < 12; x += 2) p.rect(x, 1, 1, 6, 'ink');
  return p.outline('ink');
}

function bed() {
  const p = new Pix(26, 42);
  p.rect(0, 0, 26, 42, 'slate1'); // iron frame
  p.rect(2, 2, 22, 38, 'linen1'); // sheet
  p.rect(0, 0, 26, 2, 'slate2');
  p.rect(0, 40, 26, 2, 'slate2');
  p.ellipse(13, 7, 9, 4, 'linen0'); // pillow
  p.dither(2, 10, 22, 30, 'paper2', { only: (x, y, c) => c === 'linen1' && x > 17 });
  for (const [x, y] of [[0, 0], [25, 0], [0, 41], [25, 41]]) p.set(x, y, 'brass1'); // knobs
  return p.outline('ink');
}

// Flagstones in a running bond: two courses of 16×12 stones, the second offset by half.
function floorTile() {
  const p = new Pix(32, 24).rect(0, 0, 32, 24, 'stone2');
  p.rect(0, 11, 32, 1, 'stone1').rect(0, 23, 32, 1, 'stone1'); // bed joints
  p.rect(15, 0, 1, 11, 'stone1').rect(31, 0, 1, 11, 'stone1'); // head joints, course 1
  p.rect(7, 12, 1, 11, 'stone1').rect(23, 12, 1, 11, 'stone1'); // course 2, offset
  p.dither(16, 0, 15, 11, 'stone3', { only: (x, y) => (x * 7 + y * 3) % 11 === 0 });
  p.dither(0, 12, 7, 11, 'stone3', { only: (x, y) => (x * 5 + y) % 9 === 0 });
  p.set(4, 3, 'stone3').set(27, 7, 'stone1').set(12, 17, 'stone3').set(20, 15, 'stone1').set(9, 6, 'stone1');
  return p;
}

function wallTile() {
  const p = new Pix(16, 24).rect(0, 0, 16, 24, 'paper2');
  p.rect(0, 14, 16, 10, 'wood2'); // wainscot
  p.rect(0, 14, 16, 1, 'wood4');
  p.rect(7, 15, 1, 9, 'wood1');
  p.set(4, 4, 'paper3').set(12, 9, 'paper3');
  return p;
}

function windowTex() {
  const p = new Pix(22, 18);
  p.rect(1, 3, 20, 14, 'glass1');
  p.ellipse(11, 4, 10, 3.5, 'glass1');
  p.rect(10, 1, 2, 16, 'wood3').rect(1, 9, 20, 2, 'wood3');
  p.dither(2, 3, 7, 6, 'glass2');
  return p.outline('wood1');
}

// ── Registration ────────────────────────────────────────────────────────────

// A handful of hungry leeches held up, writhing: 'hand:2:1' = two, second writhe.
export const handKey = (count: number, writhe: number) => `hand:${count}:${writhe}`;
function handful(count: number, writhe: number) {
  const p = new Pix(15 + 7 * (count - 1), 17);
  for (let i = 0; i < count; i++) {
    const w = (i + writhe) % 2 ? 1.3 : -1.3;
    p.blit(writhing(w, (i - (count - 1) / 2) * 0.35), i * 7, i % 2 ? 0 : 2);
  }
  return p;
}

const ESCAPE_ANGLES = 8;
export const escapeKey = (dir: number, wiggle: number) => `esc:${dir}:${wiggle}`;
export const escapeDir = (angle: number) => ((Math.round(angle / (Math.PI * 2 / ESCAPE_ANGLES)) % ESCAPE_ANGLES) + ESCAPE_ANGLES) % ESCAPE_ANGLES;

export function registerTextures(scene: Phaser.Scene) {
  const add = (key: string, pix: Pix) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pix.canvas());
  };
  for (const f of ['down', 'up', 'side'] as Facing[]) for (const s of [0, 1]) add(`doc:${f}:${s}`, doctor(f, s));
  add('doc:fallen', doctorFallen());
  add('daze:0', daze(0));
  add('daze:1', daze(1));
  for (let s = 0; s < 2; s++) for (let l = 0; l < 3; l++) add(`orderly:${s}:${l}`, orderly(s, l));
  // attached leeches: each feeding frame, two throbs, pointing in toward the chest
  for (let f = 0; f <= SATED; f++) for (let u = 0; u < 2; u++) add(`leech:${f}:${u}`, attached(f, u));
  add('item:leech', writhing(1.2, 0));
  add('item:used', leech({ angle: 0.9, length: 8, girth: 3.1, bend: 1, fed: 1, mouth: 'shut', eyes: false }, 13));
  // fed leeches on the floor: bloated, glistening, a smear of blood
  for (let a = 0; a < 4; a++) add(`floor:used:${a}`, leech({ angle: a * 1.4 + 0.3, length: 8.5, girth: 3, bend: a % 2 ? 1.2 : -1.2, fed: 1, mouth: 'shut', eyes: false }, 13, true));
  // escapees: an inchworm crawl — stretched out, mouth open and questing; then hunched up
  for (let d = 0; d < ESCAPE_ANGLES; d++) {
    const angle = d * (Math.PI * 2 / ESCAPE_ANGLES);
    add(escapeKey(d, 0), leech({ angle, length: 12.5, girth: 1.6, wave: 0.7, mouth: 'open' }, 15));
    add(escapeKey(d, 1), leech({ angle, length: 8, girth: 2.3, bend: 2.2, mouth: 'shut' }, 15));
  }
  add('item:lint', lint());
  add('item:sugar', sugarWater());
  add('item:bdello', bdellometer());
  for (let s = 0; s < 2; s++) for (let f = 0; f <= 4; f++) add(`cup:${s}:${f}`, cupOnChest(s, f / 4));
  add('item:stretcher', stretcher());
  add('jar', jar());
  add('bucket', bucket());
  add('cupboard', cupboard());
  add('stove:0', stove(0));
  add('stove:1', stove(1));
  add('stand:full', stand(true));
  add('stand:empty', stand(false));
  add('door', door());
  add('drain', drain());
  add('bed', bed());
  add('floor', floorTile());
  add('wall', wallTile());
  add('window', windowTex());
  add('dither', dither());
  for (let n = 1; n <= 3; n++) for (let w = 0; w < 2; w++) add(handKey(n, w), handful(n, w));
  for (const [key, draw] of Object.entries(ICONS)) add(key, draw());
}
