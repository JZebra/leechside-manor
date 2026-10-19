import Phaser from 'phaser';
import { hex } from '../art/palette';
import { CONTROLS } from '../data/lines';
import { sfx, isMuted, setMuted } from '../audio/audio';
import { playMusic } from '../audio/music';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { loadProgress } from '../ui/progress';
import { CONFIG } from '../config';
import { FLAGS } from '../flags';

export const PLATE_CREDIT =
  'Title plate: the death of the emperor Galerius, eaten by worms. Boccaccio, Des cas des nobles hommes et femmes (De casibus virorum illustrium, trans. Laurent de Premierfait), Paris, 3rd quarter of the 15th century. BnF, Français 127, f. 258r. Source gallica.bnf.fr / BnF.';
export const FONT_CREDIT = 'Type: IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open Font License.';
export const MUSIC_CREDIT =
  'Music: “Ancient Rite” and “Vanishing”, Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/';
export const SOUND_CREDIT =
  'Sounds (CC0): Kenney, Fantozzi, bart, EZduzziteh, Independent.nu, sinny and TinyWorlds, via kenney.nl and OpenGameArt.';

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
    const ph = 580;
    let pw = 560;
    if (this.textures.exists('plate')) {
      const src = this.textures.get('plate').getSourceImage() as HTMLImageElement;
      pw = Math.round((ph * src.width) / src.height);
      g.fillStyle(hex('ink')).fillRect(54, 54, pw + 12, ph + 12);
      this.add.image(60, 60, 'plate').setOrigin(0).setDisplaySize(pw, ph);
    }
    text(this, 60, 650, '“Le ixe chapitre contient le cas de Galerius … empereur des Rommains.”', { size: 17, italic: true, color: 'wood3' });
    text(this, 60, 676, `${MUSIC_CREDIT} ${SOUND_CREDIT}`, { size: 11, color: 'paper4', wrap: pw });

    const x = 60 + pw + 50;
    const w = STAGE.w - x - 60;
    text(this, x, 70, 'Leech Clinic', { font: 'display', size: 84, color: 'ink' });
    text(this, x + 4, 166, 'Val-de-Grâce, Paris · three days under Broussais', { size: 21, italic: true, color: 'red1' });
    text(this, x + 4, 210,
      'The early 1830s. Broussais orders thirty leeches for every man, and you are his house physician. ' +
      'Bleed each soldier just enough — into the green — then press lint on the bites. ' +
      'Carry out the fainted, salt the fed leeches, mind your footing, and keep the hungry ones out of the drain.',
      { size: 20, wrap: w, lineSpacing: 3 });

    // the three days: open ones can be chosen with 1–3
    const progress = loadProgress();
    if (FLAGS.day != null) progress.unlocked = CONFIG.days.length - 1; // ?day= opens every day (testing)
    let chosen = FLAGS.day ?? progress.unlocked;
    const rows = CONFIG.days.map((d, i) => {
      const open = i <= progress.unlocked;
      const best = progress.best[i];
      const t = text(this, x + 30, 392 + i * 30, `${i + 1}   ${d.title}`, { size: 19, color: open ? 'ink' : 'paper4' });
      text(this, x + w, 392 + i * 30, open ? (best != null ? `best ${best} fr` : '') : 'not yet', { size: 16, italic: true, color: 'wood3' }).setOrigin(1, 0);
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
      go.setText(`Press E or Space to begin Day ${i + 1}`);
    };
    choose(chosen);

    text(this, x, 584, CONTROLS.replace(/  ·  /g, '\n'), { size: 16, color: 'wood3', lineSpacing: 1 });
    const mute = text(this, x + w, 584, '', { size: 16, color: 'wood3', align: 'right' }).setOrigin(1, 0);
    const showMute = () => mute.setText(isMuted() ? 'Sound off (M)' : 'Sound on (M)');
    showMute();
    text(this, x, 668, `${PLATE_CREDIT} ${FONT_CREDIT}`, { size: 11, color: 'paper4', wrap: w });

    const start = () => {
      sfx('page');
      if (chosen === 0) this.registry.set('run', []);
      this.scene.start('ward', { day: chosen });
    };
    const kb = this.input.keyboard!;
    kb.on('keydown-E', start);
    kb.on('keydown-SPACE', start);
    kb.on('keydown-ENTER', start);
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
    this.input.on('pointerdown', start);
  }
}
