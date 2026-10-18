// Shared screen helpers. The game is laid out on a 1280×720 stage; the canvas
// renders at RES× that so period type stays crisp when the stage is scaled up
// (each scene's camera zooms by RES). Sprites sit on the 3px art grid.

import Phaser from 'phaser';
import { PIXEL, css, hex, type PaletteKey } from '../art/palette';

export const STAGE = { w: 1280, h: 720 };

function pickRes(): number {
  try {
    const fit = Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h);
    return fit * (window.devicePixelRatio || 1) > 1.25 ? 2 : 1;
  } catch {
    return 1;
  }
}
export const RES = pickRes();

export const FONT = {
  display: '"IM Fell English", "EB Garamond", Georgia, serif',
  body: '"EB Garamond", Georgia, serif',
};

export function fitCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  cam.centerOn(STAGE.w / 2, STAGE.h / 2);
}

export interface TextOpts {
  size?: number;
  color?: PaletteKey;
  font?: 'display' | 'body';
  italic?: boolean;
  bold?: boolean;
  stroke?: PaletteKey;
  strokeWidth?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number;
}

export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}) {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT[o.font ?? 'body'],
    fontSize: `${o.size ?? 20}px`,
    fontStyle: [o.italic ? 'italic' : '', o.bold ? 'bold' : ''].join(' ').trim() || 'normal',
    color: css(o.color ?? 'ink'),
    align: o.align ?? 'left',
    resolution: RES,
  };
  if (o.stroke) {
    style.stroke = css(o.stroke);
    style.strokeThickness = o.strokeWidth ?? 4;
  }
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  const t = scene.add.text(x, y, str, style);
  if (o.lineSpacing) t.setLineSpacing(o.lineSpacing);
  return t;
}

// Put an art-grid image at art coordinates (top-left), snapped to whole art pixels.
export function place<T extends Phaser.GameObjects.Components.Transform>(obj: T, ax: number, ay: number): T {
  obj.setPosition(Math.round(ax) * PIXEL, Math.round(ay) * PIXEL);
  return obj;
}

export function sprite(scene: Phaser.Scene, key: string, ax = 0, ay = 0) {
  return place(scene.add.image(0, 0, key).setOrigin(0, 0).setScale(PIXEL), ax, ay);
}

// A paper panel with an ink border (and an inner rule), in stage pixels on the 3px grid.
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: PaletteKey = 'paper1') {
  const P = PIXEL;
  g.fillStyle(hex('ink'));
  g.fillRect(x - P, y - P, w + 2 * P, h + 2 * P);
  g.fillStyle(hex(fill));
  g.fillRect(x, y, w, h);
  g.fillStyle(hex('paper3'));
  g.fillRect(x + 2 * P, y + 2 * P, w - 4 * P, P);
  g.fillRect(x + 2 * P, y + h - 3 * P, w - 4 * P, P);
}
