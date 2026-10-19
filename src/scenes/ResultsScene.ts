// Six o'clock: the day's report, with Broussais's verdict stamped on it. From here,
// the next day (or, after the third, the title page).

import Phaser from 'phaser';
import { CONFIG } from '../config';
import { hex, type PaletteKey } from '../art/palette';
import { OUTCOME_LABEL, VERDICT_REMARK, FINAL_REMARK } from '../data/lines';
import type { Ward } from '../model/ward';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { finishDay } from '../ui/progress';

const OUTCOME_COLOUR: Record<string, PaletteKey> = {
  green: 'stamp0',
  early: 'wood3',
  late: 'wood3',
  faint: 'red2',
  walkedOut: 'red2',
  unfinished: 'paper4',
};

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('results');
  }

  create(data: { ward: Ward }) {
    fitCamera(this);
    const ward = data.ward;
    const shift = ward.shift;
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 60, 36, 1160, 648, 'paper1');

    const day = shift.day;
    const last = day === CONFIG.days.length - 1;
    // the run so far: each day's takings, kept while the game is open
    const run = (this.registry.get('run') as number[] | undefined) ?? [];
    run[day] = shift.money;
    this.registry.set('run', run);
    const record = finishDay(day, shift.money);

    text(this, 100, 62, `${ward.layout.name} — the day’s report`, { font: 'display', size: 40 });
    text(this, 102, 112, `${shift.spec.title.replace(/ —.*/, '')} · Val-de-Grâce military hospital · for the attention of the Physician-in-Chief`, { size: 18, italic: true, color: 'red1' });

    // the patients, in two columns
    const log = shift.log;
    const perCol = 13;
    log.slice(0, perCol * 2).forEach((e, i) => {
      const col = Math.floor(i / perCol);
      const x = 100 + col * 400;
      const y = 156 + (i % perCol) * 30;
      const kind = e.type === 'anaemic' || e.type === 'nervous' ? ` (${e.type})` : ''; // drummers say so in their rank
      text(this, x, y, `${e.profile.rank} ${e.profile.surname}${kind}`, { size: 18 });
      text(this, x + 220, y + 1, OUTCOME_LABEL[e.outcome] ?? e.outcome, { size: 16, italic: true, color: OUTCOME_COLOUR[e.outcome] ?? 'wood3' });
      if (e.fee) text(this, x + 385, y, `${e.fee > 0 ? '+' : ''}${e.fee}`, { size: 18, color: e.fee > 0 ? 'ink' : 'red2' }).setOrigin(1, 0);
    });
    if (log.length > perCol * 2) text(this, 100, 156 + perCol * 30, `… and ${log.length - perCol * 2} more`, { size: 16, italic: true, color: 'wood3' });
    if (!log.length) text(this, 100, 156, 'Not a man treated.', { size: 20, italic: true });

    // the sums
    const counts = (o: string) => log.filter((e) => e.outcome === o).length;
    const lines = [
      `Bled just right: ${counts('green')}`,
      `Stopped early or late: ${counts('early') + counts('late')}`,
      `Fainted: ${counts('faint')}`,
      `Gave up waiting: ${counts('walkedOut')}`,
      `Leeches applied: ${ward.applied}`,
      `Leeches lost: ${ward.lost}${ward.slips ? ` (${ward.slips} squashed underfoot)` : ''}`,
      `Fed leeches left on the floor: ${ward.floorAtBell}`,
    ];
    text(this, 920, 156, lines.join('\n'), { size: 18, lineSpacing: 6 });
    text(this, 920, 372, `Takings: ${shift.money} francs`, { font: 'display', size: 30, color: shift.money >= 0 ? 'ink' : 'red2' });
    const v = shift.spec.verdict;
    if (record) text(this, 1196, 344, 'a new best for this day', { size: 16, italic: true, color: 'red2' }).setOrigin(1, 0);
    text(this, 922, 412, `Approved at ${v.approved} fr · noted at ${v.noted} fr`, { size: 15, italic: true, color: 'wood3' });

    // Broussais's stamp, thumped down in steps
    const verdict = shift.verdict();
    const ink: PaletteKey = verdict === 'APPROVED' ? 'stamp0' : 'red2';
    const stamp = this.add.container(1060, 510);
    const word = text(this, 0, 2, verdict, { font: 'display', size: 44, color: ink }).setOrigin(0.5);
    const sg = this.add.graphics();
    const sw = Math.ceil((word.width + 60) / 6) * 6, sh = 84;
    sg.fillStyle(hex(ink)).fillRect(-sw / 2, -sh / 2, sw, sh);
    sg.fillStyle(hex('paper1')).fillRect(-sw / 2 + 6, -sh / 2 + 6, sw - 12, sh - 12);
    sg.fillStyle(hex(ink)).fillRect(-sw / 2 + 12, -sh / 2 + 12, sw - 24, sh - 24);
    sg.fillStyle(hex('paper1')).fillRect(-sw / 2 + 15, -sh / 2 + 15, sw - 30, sh - 30);
    stamp.add(sg);
    stamp.add(word);
    stamp.setScale(1.6).setVisible(false);
    const total = run.reduce((a, b) => a + (b ?? 0), 0);
    const remark = last && run.filter((x) => x != null).length === CONFIG.days.length
      ? `${FINAL_REMARK} Your three years: ${total} francs.`
      : VERDICT_REMARK[verdict];
    text(this, 920, 572, remark, { size: 18, italic: true, wrap: 280, color: 'wood2' });
    text(this, 1196, 648, '— F.-J.-V. Broussais', { size: 16, italic: true, color: 'wood3' }).setOrigin(1, 0);

    this.time.delayedCall(700, () => {
      stamp.setVisible(true);
      this.tweens.add({ targets: stamp, scale: 1, duration: 160, ease: 'Stepped', easeParams: [3], onComplete: () => sfx('stamp') });
    });

    const next = last ? 'E / Space — the title page' : `E / Space — ${CONFIG.days[day + 1].title}`;
    text(this, 100, 648, `${next}   ·   R — this day again   ·   T — title`, { font: 'display', size: 22, color: 'red2' });
    const kb = this.input.keyboard!;
    const go = () => {
      sfx('page');
      if (last) this.scene.start('title');
      else this.scene.start('ward', { day: day + 1 });
    };
    this.time.delayedCall(800, () => {
      kb.on('keydown-E', go);
      kb.on('keydown-SPACE', go);
      kb.on('keydown-ENTER', go);
      kb.on('keydown-R', () => this.scene.start('ward', { day }));
      kb.on('keydown-T', () => this.scene.start('title'));
    });
  }
}
