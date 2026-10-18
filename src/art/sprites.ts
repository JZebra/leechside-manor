// Every sprite in the ward, drawn procedurally into palette-locked Pix buffers
// (the Thirty Leeches way) and registered as Phaser textures. One texture pixel =
// one art pixel; the game shows them at PIXEL×.

import Phaser from 'phaser';
import { Pix } from './pix';
import { SKIN, HAIR, PALLOR_LADDER, type PaletteKey, type Ramp } from './palette';

// ── Leeches (from Thirty Leeches' sprites.js, plus faces) ────────────────────

const LEECH_FRAMES = [
  { rx: 1.4, ry: 3.2 },
  { rx: 1.9, ry: 3.6 },
  { rx: 2.4, ry: 4.0 },
  { rx: 2.9, ry: 4.5 },
];
export const SATED = LEECH_FRAMES.length - 1;

// One leech centred at (cx, cy), pointing along angle (0 = up).
export function drawLeech(pix: Pix, cx: number, cy: number, angle: number, frame = 0, scale = 1, face = false) {
  const { rx: rx0, ry: ry0 } = LEECH_FRAMES[frame];
  const rx = rx0 * scale;
  const ry = ry0 * scale;
  const sated = frame === SATED;
  const body: PaletteKey = sated ? 'red0' : 'leech1';
  pix.ellipse(cx, cy, rx, ry, body, { angle });
  const ox = Math.cos(angle);
  const oy = Math.sin(angle);
  pix.ellipse(cx + ox * rx * 0.55, cy + oy * rx * 0.55, rx * 0.5, ry * 0.9, sated ? 'leech1' : 'leech0', { angle, only: (x, y, c) => c === body });
  pix.ellipse(cx - ox * rx * 0.2, cy - oy * rx * 0.2, Math.max(0.5, rx * 0.25), ry * 0.65, sated ? 'red1' : 'leechStripe',
    { angle, only: (x, y, c) => c === body && (x + y) % 2 === 0 });
  const hx = cx + Math.sin(angle) * ry * 0.5;
  const hy = cy - Math.cos(angle) * ry * 0.5;
  if (face) {
    // two beady eyes near the head end
    pix.set(Math.floor(hx - ox * rx * 0.45), Math.floor(hy - oy * rx * 0.45), 'linen0');
    pix.set(Math.floor(hx + ox * rx * 0.45), Math.floor(hy + oy * rx * 0.45), 'linen0');
  } else {
    pix.set(Math.floor(hx - ox * rx * 0.4), Math.floor(hy - oy * rx * 0.4), 'leechGloss');
  }
}

function leech(frame: number, angle: number, opts: { scale?: number; face?: boolean; size?: number } = {}) {
  const size = opts.size ?? 13;
  const p = new Pix(size, size);
  drawLeech(p, size / 2, size / 2, angle, frame, opts.scale ?? 1, opts.face ?? false);
  return p.outline('leech0');
}

// A stubborn leech: curled into a C, face turned away, a frown.
function stubbornLeech() {
  const p = new Pix(13, 13);
  p.ellipse(6.5, 6.5, 4.6, 4.2, 'leech1');
  p.ellipse(6.5, 6.5, 2.0, 1.8, null);
  p.rect(7, 4, 4, 3, null); // the gap of the C
  p.ellipse(4.5, 7, 1.6, 2.5, 'leech0', { only: (x, y, c) => c === 'leech1' });
  p.dither(2, 3, 9, 8, 'leechStripe', { only: (x, y, c) => c === 'leech1' && y > 8 });
  // face on the tail end, looking away: a frown and a scowl
  p.set(9, 8, 'linen0').set(10, 9, 'ink').set(8, 10, 'ink').set(9, 10, 'ink');
  return p.outline('leech0');
}

// ── People ───────────────────────────────────────────────────────────────────

export interface PatientLook {
  skin: string; // 'A' | 'B' | 'C'
  hair: string;
  moustache: boolean;
  build: 'normal' | 'thin' | 'small';
  pallor: number; // 0–3
  eyes: 'open' | 'closed' | 'wide';
  sweat: boolean;
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
  // army blanket from the waist down: grey wool with a red stripe
  p.rect(1, 24, 20, 12, 'slate2');
  p.rect(1, 24, 20, 1, 'slate1');
  p.rect(1, 28, 20, 2, 'red1');
  p.dither(13, 25, 8, 11, 'slate1');
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
  p.rect(cx - 1, mouthY, 2, 1, look.pallor >= 2 ? S[3] : 'red1');
  if (look.moustache && !small) p.rect(cx - 2, mouthY - 1, 4, 1, H[1]);
  if (look.sweat) p.set(cx - r - 1, headY - 2, 'blue1').set(cx + r + 1, headY - 1, 'blue1').set(cx + r + 1, headY, 'blue0');
  return p.outline('ink');
}

export const PATIENT_TEX = (look: PatientLook) =>
  `pt:${look.skin}:${look.hair}:${look.moustache ? 1 : 0}:${look.build}:${look.pallor}:${look.eyes}:${look.sweat ? 1 : 0}`;

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

const ESCAPE_ANGLES = 8;
export const escapeKey = (dir: number, wiggle: number) => `esc:${dir}:${wiggle}`;
export const escapeDir = (angle: number) => ((Math.round(angle / (Math.PI * 2 / ESCAPE_ANGLES)) % ESCAPE_ANGLES) + ESCAPE_ANGLES) % ESCAPE_ANGLES;

export function registerTextures(scene: Phaser.Scene) {
  const add = (key: string, pix: Pix) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pix.canvas());
  };
  for (const f of ['down', 'up', 'side'] as Facing[]) for (const s of [0, 1]) add(`doc:${f}:${s}`, doctor(f, s));
  // attached leeches: each feeding frame, pointing in toward the chest
  for (let f = 0; f <= SATED; f++) add(`leech:${f}`, leech(f, 0.35));
  add('item:leech', leech(1, 0, { scale: 1.25, face: true, size: 15 }));
  add('item:stubborn', stubbornLeech());
  add('item:used', leech(SATED, 0.9, { face: false }));
  for (let a = 0; a < 4; a++) add(`floor:used:${a}`, leech(SATED, a * 1.4 + 0.3));
  for (let d = 0; d < ESCAPE_ANGLES; d++) {
    const angle = d * (Math.PI * 2 / ESCAPE_ANGLES);
    add(escapeKey(d, 0), leech(1, angle - 0.25, { face: true }));
    add(escapeKey(d, 1), leech(0, angle + 0.25, { face: true }));
  }
  add('item:lint', lint());
  add('item:sugar', sugarWater());
  add('item:bdello', bdellometer());
  for (let s = 0; s < 2; s++) for (let f = 0; f <= 4; f++) add(`bdello:${s}:${f}`, bdellometer(s, f / 4));
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
  for (const [key, draw] of Object.entries(ICONS)) add(key, draw());
}
