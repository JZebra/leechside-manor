// The register of the Val-de-Grâce: the best takings for each year. With a server, the one
// every doctor signs (Tab shows this browser's own); without one, or if it can't be reached,
// this browser's.

import Phaser from 'phaser';
import { CONFIG } from '../config';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { soundButton } from '../ui/sound';
import { loadBoard, fetchBoard, BOARD_SIZE, type Board } from '../ui/board';
import { SERVER } from '../net/client';
import { REGISTER } from '../data/lines';

export class BoardScene extends Phaser.Scene {
  private rows: Phaser.GameObjects.GameObject[] = [];
  private visit = 0;

  constructor() {
    super('board');
  }

  create() {
    fitCamera(this);
    soundButton(this);
    this.rows = [];
    const visit = ++this.visit;
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 60, 36, 1160, 648, 'paper1');
    text(this, 640, 62, REGISTER.heading, { font: 'display', size: 46 }).setOrigin(0.5, 0);
    const sub = text(this, 640, 122, '', { size: 18, italic: true, color: 'red1' }).setOrigin(0.5, 0);
    const swap = text(this, 1180, 646, '', { size: 18, italic: true, color: 'wood3' }).setOrigin(1, 0);

    const here = loadBoard();
    let everyone: Board | null = null;
    let showing: 'everyone' | 'here' = 'here';
    const show = (which: 'everyone' | 'here') => {
      showing = which;
      this.draw(which === 'everyone' && everyone ? everyone : here);
      sub.setText(which === 'everyone' ? REGISTER.subheading : everyone || !SERVER ? REGISTER.subheadingHere : REGISTER.offline);
      swap.setText(everyone ? (which === 'everyone' ? REGISTER.toHere : REGISTER.toOnline) : '');
    };

    if (SERVER) {
      sub.setText(REGISTER.fetching);
      fetchBoard().then((b) => {
        if (visit !== this.visit || !this.sys.isActive()) return;
        everyone = b;
        show(b ? 'everyone' : 'here');
      });
    } else show('here');

    text(this, 640, 646, REGISTER.back, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    const back = () => {
      sfx('page');
      this.scene.start('title');
    };
    const kb = this.input.keyboard!;
    for (const k of ['E', 'SPACE', 'ENTER', 'ESC', 'L']) kb.on(`keydown-${k}`, back);
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      if (!everyone) return;
      sfx('page');
      show(showing === 'everyone' ? 'here' : 'everyone');
    });
  }

  // Each year's ten best, in three columns.
  private draw(board: Board) {
    for (const o of this.rows) o.destroy();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.rows.push(o), o);
    const g = add(this.add.graphics());
    const columns = CONFIG.days.map((d) => ({ head: String(d.year), list: board.years[String(d.year)] ?? [] }));
    const colW = 340;
    columns.forEach((c, i) => {
      const x = 130 + i * colW;
      add(text(this, x, 176, c.head, { font: 'display', size: 28 }));
      g.fillStyle(hex('paper3')).fillRect(x, 214, colW - 30, 3);
      for (let r = 0; r < BOARD_SIZE; r++) {
        const e = c.list[r];
        const y = 228 + r * 36;
        add(text(this, x, y, `${r + 1}.`, { size: 18, color: 'wood3' }));
        if (!e) {
          add(text(this, x + 34, y, '—', { size: 18, color: 'paper4' }));
          continue;
        }
        add(text(this, x + 34, y, e.name, { size: 19, color: r === 0 ? 'red1' : 'ink' }));
        add(text(this, x + colW - 34, y, `${e.money} fr`, { size: 18, color: e.money < 0 ? 'red2' : 'ink' }).setOrigin(1, 0));
      }
    });
    if (!columns.some((c) => c.list.length)) {
      add(text(this, 640, 400, REGISTER.empty, { size: 22, italic: true, color: 'wood3' }).setOrigin(0.5));
    }
  }
}
