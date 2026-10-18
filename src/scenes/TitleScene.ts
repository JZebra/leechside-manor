import Phaser from 'phaser';
import { hex } from '../art/palette';
import { CONTROLS } from '../data/lines';
import { sfx, isMuted, setMuted } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { loadBest } from '../ui/best';

export const PLATE_CREDIT =
  'Title plate: C.-J. Traviès, “Encore quatre-vingt-dix sangsues!”, Tableau de Paris, coloured lithograph, c. 1827 — a satire of Broussais. Wellcome Collection, public domain.';
export const FONT_CREDIT = 'Type: IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open Font License.';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    fitCamera(this);
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
    text(this, 60, 668, '“Ninety more leeches! … and keep him on the diet.”', { size: 17, italic: true, color: 'wood3' });

    const x = 60 + pw + 50;
    const w = STAGE.w - x - 60;
    text(this, x, 70, 'Leech Clinic', { font: 'display', size: 84, color: 'ink' });
    text(this, x + 4, 166, 'Salle Saint-Côme, Val-de-Grâce · a shift under Broussais', { size: 21, italic: true, color: 'red1' });
    text(this, x + 4, 214,
      'Paris, the early 1830s. Broussais orders thirty leeches for every man. You are his house physician, ' +
      'with one shift from eight o’clock to the six o’clock bell.\n\n' +
      'Bleed each soldier just enough — into the green — then press lint on the bites. ' +
      'Carry the fainted to the convalescents, salt the fed leeches, and keep the hungry ones out of the drain.',
      { size: 21, wrap: w, lineSpacing: 4 });

    panel(g, x, 498, w, 66, 'paper0');
    const go = text(this, x + w / 2, 531, 'Press E or Space to begin the shift', { font: 'display', size: 30, color: 'red2' }).setOrigin(0.5);
    this.tweens.add({ targets: go, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });

    text(this, x, 584, CONTROLS.replace(/  ·  /g, '\n'), { size: 16, color: 'wood3', lineSpacing: 1 });
    const mute = text(this, x + w, 584, '', { size: 16, color: 'wood3', align: 'right' }).setOrigin(1, 0);
    const showMute = () => mute.setText(isMuted() ? 'Sound off (M)' : 'Sound on (M)');
    showMute();
    const best = loadBest();
    if (best) text(this, x + w, 470, `Best shift: ${best.money} francs — ${best.verdict.toLowerCase()}`, { size: 17, italic: true, color: 'wood3', align: 'right' }).setOrigin(1, 0.5);
    text(this, x, 668, `${PLATE_CREDIT} ${FONT_CREDIT}`, { size: 12, color: 'paper4', wrap: w });

    const start = () => {
      sfx('page');
      this.scene.start('ward');
    };
    const kb = this.input.keyboard!;
    kb.on('keydown-E', start);
    kb.on('keydown-SPACE', start);
    kb.on('keydown-ENTER', start);
    kb.on('keydown-M', () => {
      setMuted(!isMuted());
      showMute();
      sfx('click');
    });
    this.input.on('pointerdown', start);
  }
}
