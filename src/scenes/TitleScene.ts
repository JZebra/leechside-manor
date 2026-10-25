import Phaser from 'phaser';
import { hex } from '../art/palette';
import { CONTROLS, GAME_TITLE, TITLE } from '../data/lines';
import { sfx, isMuted, setMuted } from '../audio/audio';
import { playMusic } from '../audio/music';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { loadProgress } from '../ui/progress';
import { CONFIG } from '../config';
import { FLAGS } from '../flags';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    fitCamera(this);
    playMusic('title');
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('paper1')).setOrigin(0);
    const g = this.add.graphics();

    // the plate, framed in ink
    const ph = 600;
    let pw = 560;
    if (this.textures.exists('plate')) {
      const src = this.textures.get('plate').getSourceImage() as HTMLImageElement;
      pw = Math.round((ph * src.width) / src.height);
      g.fillStyle(hex('ink')).fillRect(54, 54, pw + 12, ph + 12);
      this.add.image(60, 60, 'plate').setOrigin(0).setDisplaySize(pw, ph);
    }
    text(this, 60, 668, TITLE.plateCaption, { size: 17, italic: true, color: 'wood3' });

    const x = 60 + pw + 50;
    const w = STAGE.w - x - 60;
    // the name, as large as the column allows
    const name = text(this, x, 70, GAME_TITLE, { font: 'display', size: 84, color: 'ink' });
    for (let size = 84; name.width > w && size > 40; size -= 4) name.setFontSize(size);
    text(this, x + 4, 166, TITLE.subtitle, { size: 21, italic: true, color: 'red1' });
    text(this, x + 4, 210, TITLE.intro, { size: 20, wrap: w, lineSpacing: 3 });

    // the three years: open ones can be chosen with 1–3 (or the arrow keys)
    const progress = loadProgress();
    if (FLAGS.day != null) progress.unlocked = CONFIG.days.length - 1; // ?day= opens every day (testing)
    let chosen = FLAGS.day ?? progress.unlocked;
    const rows = CONFIG.days.map((d, i) => {
      const open = i <= progress.unlocked;
      const best = progress.best[i];
      const t = text(this, x + 30, 392 + i * 30, `${i + 1}   ${d.title}`, { size: 19, color: open ? 'ink' : 'paper4' });
      text(this, x + w, 392 + i * 30, open ? (best != null ? TITLE.best(best) : '') : TITLE.locked, { size: 16, italic: true, color: 'wood3' }).setOrigin(1, 0);
      return t;
    });
    const marker = text(this, x + 6, 392, '▸', { size: 19, color: 'red2' });

    panel(g, x, 498, w, 66, 'paper0');
    const go = text(this, x + w / 2, 531, '', { font: 'display', size: 30, color: 'red2' }).setOrigin(0.5);
    this.tweens.add({ targets: go, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
    const choose = (i: number) => {
      if (i > progress.unlocked) return;
      chosen = i;
      marker.setY(rows[i].y);
      go.setText(TITLE.begin(CONFIG.days[i].year));
    };
    choose(chosen);

    text(this, x, 584, CONTROLS.replace(/  ·  /g, '\n'), { size: 16, color: 'wood3', lineSpacing: 1 });
    const mute = text(this, x + w, 584, '', { size: 16, color: 'wood3', align: 'right' }).setOrigin(1, 0);
    const showMute = () => mute.setText(isMuted() ? TITLE.soundOff : TITLE.soundOn);
    showMute();
    text(this, x, 668, TITLE.menu, { font: 'display', size: 20, color: 'wood3' });
    text(this, x + w, 668, TITLE.byline, { size: 15, italic: true, color: 'paper4' }).setOrigin(1, 0);

    const start = () => {
      sfx('page');
      if (chosen === 0) this.registry.set('run', []);
      this.scene.start('ward', { day: chosen });
    };
    const kb = this.input.keyboard!;
    kb.on('keydown-E', start);
    kb.on('keydown-SPACE', start);
    kb.on('keydown-ENTER', start);
    kb.on('keydown-L', () => {
      sfx('page');
      this.scene.start('board');
    });
    kb.on('keydown-C', () => {
      sfx('page');
      this.scene.start('credits');
    });
    kb.on('keydown-ONE', () => choose(0));
    kb.on('keydown-TWO', () => choose(1));
    kb.on('keydown-THREE', () => choose(2));
    kb.on('keydown-UP', () => choose(Math.max(0, chosen - 1)));
    kb.on('keydown-DOWN', () => choose(Math.min(progress.unlocked, chosen + 1)));
    kb.on('keydown-M', () => {
      setMuted(!isMuted());
      showMute();
      sfx('click');
    });
  }
}
