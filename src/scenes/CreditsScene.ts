// Who made the game, and whose work it stands on: music, sounds, the title plate, type.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';

const SECTIONS: { head: string; lines: string[] }[] = [
  {
    head: 'Music',
    lines: [
      '“Ancient Rite” Kevin MacLeod (incompetech.com)',
      '“Vanishing” Kevin MacLeod (incompetech.com)',
      'Licensed under Creative Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/',
    ],
  },
  {
    head: 'Sound effects',
    lines: [
      'All public domain (Creative Commons CC0); credit gladly given.',
      'Doors and cloth: Kenney, RPG Audio (kenney.nl)',
      'Footsteps on stone: Fantozzi · Wet splats: Independent.nu — both via qubodup, OpenGameArt',
      'Slow heartbeat: bart · Squelches and pops: EZduzziteh · Scissors: sinny · Boiling water: TinyWorlds — OpenGameArt',
      'Everything else synthesised in the browser with filtered noise and jsfxr.',
    ],
  },
  {
    head: 'Title plate',
    lines: [
      'The death of the emperor Galerius, eaten by worms. Boccaccio, Des cas des nobles hommes et femmes',
      '(trans. Laurent de Premierfait), Paris, 3rd quarter of the 15th century. BnF, Français 127, f. 258r. Source gallica.bnf.fr / BnF.',
    ],
  },
  {
    head: 'Type',
    lines: ['IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open Font License.'],
  },
];

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  create() {
    fitCamera(this);
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 90, 36, 1100, 648, 'paper1');

    text(this, 640, 66, 'Credits', { font: 'display', size: 46 }).setOrigin(0.5, 0);
    text(this, 640, 130, 'Leech Clinic was developed for Ludum Dare 60 (“Old Tech”) by John Shen, using Claude AI.', { size: 21, italic: true, color: 'red1' }).setOrigin(0.5, 0);

    let y = 186;
    for (const s of SECTIONS) {
      text(this, 140, y, s.head, { font: 'display', size: 24, color: 'ink' });
      y += 34;
      for (const line of s.lines) {
        const t = text(this, 160, y, line, { size: 17, color: 'wood2', wrap: 990 });
        y += t.height + 4;
      }
      y += 14;
    }

    text(this, 640, 646, 'E / Space / Esc — back', { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    const back = () => {
      sfx('page');
      this.scene.start('title');
    };
    const kb = this.input.keyboard!;
    for (const k of ['E', 'SPACE', 'ENTER', 'ESC', 'C']) kb.on(`keydown-${k}`, back);
  }
}
