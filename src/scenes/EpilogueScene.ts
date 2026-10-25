// After the 1832 report: what became of Broussais, the leeches and you.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE, type TextOpts } from '../ui/view';
import { FINAL_REMARK } from '../data/lines';

export class EpilogueScene extends Phaser.Scene {
  constructor() {
    super('epilogue');
  }

  create(data: { francs: number }) {
    fitCamera(this);
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 90, 36, 1100, 648, 'paper1');

    text(this, 640, 66, FINAL_REMARK.heading, { font: 'display', size: 46 }).setOrigin(0.5, 0);

    let y = 148;
    const para = (s: string, style: TextOpts) => {
      const t = text(this, 170, y, s, { wrap: 940, lineSpacing: 3, ...style });
      y += t.height + 22;
    };
    for (const s of FINAL_REMARK.history) para(s, { size: 23, color: 'wood2' });
    para(FINAL_REMARK.money(data.francs), { font: 'display', size: 28, color: 'red1' });
    para(FINAL_REMARK.coda, { size: 23, italic: true, color: 'wood2' });

    text(this, 640, 646, FINAL_REMARK.footer, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    const back = () => {
      sfx('page');
      this.scene.start('title');
    };
    // a moment's grace, so the key that turned the page doesn't turn this one too
    this.time.delayedCall(500, () => {
      const kb = this.input.keyboard!;
      for (const k of ['E', 'SPACE', 'ENTER', 'ESC']) kb.on(`keydown-${k}`, back);
    });
  }
}
