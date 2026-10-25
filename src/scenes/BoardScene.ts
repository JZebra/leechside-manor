// The register of the Val-de-Grâce: the best takings for each year.

import Phaser from 'phaser';
import { CONFIG } from '../config';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { loadBoard, BOARD_SIZE, type BoardEntry } from '../ui/board';
import { REGISTER } from '../data/lines';

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('board');
  }

  create() {
    fitCamera(this);
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 60, 36, 1160, 648, 'paper1');
    text(this, 640, 62, REGISTER.heading, { font: 'display', size: 46 }).setOrigin(0.5, 0);
    text(this, 640, 122, REGISTER.subheading, { size: 18, italic: true, color: 'red1' }).setOrigin(0.5, 0);

    const board = loadBoard();
    const columns: { head: string; list: BoardEntry[] }[] = CONFIG.days.map((d) => ({ head: String(d.year), list: board.years[String(d.year)] ?? [] }));
    const colW = 340;
    columns.forEach((c, i) => {
      const x = 130 + i * colW;
      text(this, x, 176, c.head, { font: 'display', size: 28 });
      g.fillStyle(hex('paper3')).fillRect(x, 214, colW - 30, 3);
      for (let r = 0; r < BOARD_SIZE; r++) {
        const e = c.list[r];
        const y = 228 + r * 36;
        text(this, x, y, `${r + 1}.`, { size: 18, color: 'wood3' });
        if (!e) {
          text(this, x + 34, y, '—', { size: 18, color: 'paper4' });
          continue;
        }
        text(this, x + 34, y, e.name, { size: 19, color: r === 0 ? 'red1' : 'ink' });
        text(this, x + colW - 34, y, `${e.money} fr`, { size: 18, color: e.money < 0 ? 'red2' : 'ink' }).setOrigin(1, 0);
      }
    });
    if (!columns.some((c) => c.list.length)) {
      text(this, 640, 400, REGISTER.empty, { size: 22, italic: true, color: 'wood3' }).setOrigin(0.5);
    }

    text(this, 640, 646, REGISTER.back, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    const back = () => {
      sfx('page');
      this.scene.start('title');
    };
    const kb = this.input.keyboard!;
    for (const k of ['E', 'SPACE', 'ENTER', 'ESC', 'L']) kb.on(`keydown-${k}`, back);
  }
}
