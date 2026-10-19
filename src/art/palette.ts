// The master palette, shared with Thirty Leeches (../thirty-leeches/src/data/palette.js)
// plus a few ramps this ward needs. Every sprite pixel and every UI colour comes
// from here — a limited, SNES-style set of ramps (dark → light within each ramp).

export const PIXEL = 3; // screen pixels per art pixel: the one grid every sprite sits on

export const PALETTE = {
  // ink and outline
  ink: '#140d0a',
  ink1: '#2c1e16',

  // wood: desk, frames, book boards
  wood0: '#1e130d',
  wood1: '#2f1e14',
  wood2: '#45301f',
  wood3: '#5e432b',
  wood4: '#7a5838',

  // paper
  paper0: '#f6edd6',
  paper1: '#ecdfc0',
  paper2: '#d9c69e',
  paper3: '#bba37a',
  paper4: '#94805c',

  // skin ramps: 0 light, 1 base, 2 shadow, 3 deep shadow / outline
  skinA0: '#f8dcbc', skinA1: '#e9bb93', skinA2: '#c98f66', skinA3: '#9a6446', // fair
  skinB0: '#eec29a', skinB1: '#d49d71', skinB2: '#ad7250', skinB3: '#7d4c34', // weathered
  skinC0: '#c98d60', skinC1: '#a36a43', skinC2: '#7a4a2e', skinC3: '#55321f', // dark
  pallid0: '#f1e2ca', pallid1: '#ddc6aa', pallid2: '#b9a189', pallid3: '#8a7664', // bled, drawn
  pale0: '#eeebdc', pale1: '#d2cfbe', pale2: '#aaa898', pale3: '#7d7c70', // anaemic, ashen
  wax0: '#f8f6ee', wax1: '#e6e4d8', wax2: '#c4c2b4', wax3: '#96958a', // white as wax

  // hair
  hairBlack: '#1a1411',
  hairDark: '#3a2618',
  hairBrown: '#5e3b22',
  hairAuburn: '#7e4526',
  hairBlond: '#b88d4b',
  hairGrey: '#9c968a',
  hairWhite: '#c6c0b2',

  // uniforms
  navy0: '#18203a', navy1: '#27345c', navy2: '#3b4c80', navy3: '#5a6ca4',
  green0: '#1e3326', green1: '#2e4b36', green2: '#456a4c',
  slate0: '#2c2c34', slate1: '#45454f', slate2: '#66666f',

  // red: facings, blood, wax seals
  red0: '#3e1010', red1: '#6e1a1a', red2: '#9e2a24', red3: '#c8483a',

  // bruises: core → rim → old yellowing edge
  bruise0: '#2e1530', bruise1: '#4f2650', bruise2: '#734070', bruise3: '#8f6a4a', bruise4: '#a8954a',

  // brass, linen
  brass0: '#5e4a1c', brass1: '#9a7a2e', brass2: '#d0b058',
  linen0: '#fbf7ec', linen1: '#ddd6c4',

  // leeches: olive-black, with the medicinal leech's rusty stripe
  leech0: '#0f140c', leech1: '#1f2a17', leech2: '#34442a', leechStripe: '#b07a2c', leechGloss: '#7d8a62',

  // glass and river water
  glass0: '#5c726c', glass1: '#8ea69e', glass2: '#c4d4cc', water0: '#3c5048', water1: '#55705f',

  // cholera blue: lips, nail-beds
  blue0: '#5d6b7c', blue1: '#8592a0',

  // a sickroom green for approval stamps
  stamp0: '#2e4a2c',

  // Leechside Manor additions: flagstones, copper (kettle), the meter's bright bands
  stone0: '#2f2a27', stone1: '#463f3a', stone2: '#5c544d', stone3: '#766c62',
  copper0: '#5e2f1c', copper1: '#8e4a2a', copper2: '#c07a48',
  meterGreen: '#5f8a4a', meterBlue: '#4a6aa8', meterGreen1: '#9ccc78', meterBlue1: '#8eb0e6',
} as const;

export type PaletteKey = keyof typeof PALETTE;
export type Ramp = readonly PaletteKey[];

// 0xRRGGBB for Phaser graphics, '#rrggbb' for text.
export const hex = (k: PaletteKey): number => parseInt(PALETTE[k].slice(1), 16);
export const css = (k: PaletteKey): string => PALETTE[k];

// Skin ramps by name, and the pallor ladder they climb as blood is lost.
export const SKIN: Record<string, Ramp> = {
  A: ['skinA0', 'skinA1', 'skinA2', 'skinA3'],
  B: ['skinB0', 'skinB1', 'skinB2', 'skinB3'],
  C: ['skinC0', 'skinC1', 'skinC2', 'skinC3'],
  pallid: ['pallid0', 'pallid1', 'pallid2', 'pallid3'],
  pale: ['pale0', 'pale1', 'pale2', 'pale3'],
  wax: ['wax0', 'wax1', 'wax2', 'wax3'],
};
export const PALLOR_LADDER = [null, 'pallid', 'pale', 'wax'] as const; // 0 = his own colour

// Hair: [shadow, base, highlight].
export const HAIR: Record<string, Ramp> = {
  hairBlack: ['ink', 'hairBlack', 'hairDark'],
  hairDark: ['hairBlack', 'hairDark', 'hairBrown'],
  hairBrown: ['hairDark', 'hairBrown', 'hairAuburn'],
  hairAuburn: ['hairBrown', 'hairAuburn', 'hairBlond'],
  hairBlond: ['hairBrown', 'hairBlond', 'paper2'],
  hairGrey: ['paper4', 'hairGrey', 'hairWhite'],
  hairWhite: ['hairGrey', 'hairWhite', 'linen1'],
};

export const COATS: Record<string, Ramp> = {
  navy: ['navy0', 'navy1', 'navy2', 'navy3'],
  green: ['green0', 'green1', 'green2', 'green2'],
  slate: ['slate0', 'slate1', 'slate2', 'slate2'],
};
