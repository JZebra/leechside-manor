// Who made the game, and whose work it stands on: music, sounds, the title plate, type.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { CREDITS } from '../data/lines';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  create() {
    fitCamera(this);
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 90, 36, 1100, 648, 'paper1');

    text(this, 640, 66, CREDITS.heading, { font: 'display', size: 46 }).setOrigin(0.5, 0);
    text(this, 640, 130, CREDITS.madeBy, { size: 21, italic: true, color: 'red1' }).setOrigin(0.5, 0);

    let y = 186;
    for (const s of CREDITS.sections) {
      text(this, 140, y, s.head, { font: 'display', size: 24, color: 'ink' });
      y += 34;
      for (const line of s.lines) {
        const t = text(this, 160, y, line, { size: 17, color: 'wood2', wrap: 990 });
        y += t.height + 4;
      }
      y += 14;
    }

    text(this, 640, 646, CREDITS.back, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    const back = () => {
      sfx('page');
      this.scene.start('title');
    };
    const kb = this.input.keyboard!;
    for (const k of ['E', 'SPACE', 'ENTER', 'ESC', 'C']) kb.on(`keydown-${k}`, back);
  }
}
