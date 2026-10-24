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
import { loadBoard, qualifies, signYear, signTotal, lastName, rememberName, today, ordinal, NAME_MAX } from '../ui/board';

const OUTCOME_COLOUR: Record<string, PaletteKey> = {
  green: 'stamp0',
  early: 'wood3',
  late: 'wood3',
  faint: 'red2',
  walkedOut: 'red2',
  unfinished: 'paper4',
};

export class ResultsScene extends Phaser.Scene {
  private entering = false; // typing a name for the leaderboard: the other keys wait
  private signedAt = -1e9;

  constructor() {
    super('results');
  }

  create(data: { ward: Ward }) {
    fitCamera(this);
    this.entering = false;
    this.signedAt = -1e9;
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
    const footer = text(this, 100, 648, `${next}   ·   R — this day again   ·   T — title`, { font: 'display', size: 22, color: 'red2' });
    const kb = this.input.keyboard!;
    const idle = () => this.entering || this.time.now - this.signedAt < 300; // the Enter that signs mustn't also leave
    const go = () => {
      if (idle()) return;
      sfx('page');
      if (last) this.scene.start('title');
      else this.scene.start('ward', { day: day + 1 });
    };
    this.time.delayedCall(800, () => {
      kb.on('keydown-E', go);
      kb.on('keydown-SPACE', go);
      kb.on('keydown-ENTER', go);
      kb.on('keydown-R', () => !idle() && this.scene.start('ward', { day }));
      kb.on('keydown-T', () => !idle() && this.scene.start('title'));
    });

    // the leaderboard: sign for this year's top ten, and for the three years if it was a full run
    const board = loadBoard();
    const year = shift.spec.year;
    const fullRun = last && run.filter((x) => x != null).length === CONFIG.days.length;
    const yearQ = qualifies(board.years[String(year)] ?? [], shift.money);
    const totalQ = fullRun && qualifies(board.total, total);
    if (yearQ || totalQ) this.signing(year, shift.money, verdict, totalQ ? total : null, footer);
  }

  // A place on the board: type a name (Enter signs, Esc leaves it unsigned).
  private signing(year: number, money: number, verdict: string, total: number | null, footer: Phaser.GameObjects.Text) {
    this.entering = true;
    footer.setAlpha(0.35);
    const g = this.add.graphics();
    panel(g, 100, 566, 760, 66, 'paper0');
    const what = total != null ? `this year and for the three years` : `the ${year} board`;
    text(this, 118, 574, `A place on ${what}! Sign the register:`, { size: 18, italic: true, color: 'red1' });
    const field = text(this, 118, 598, '', { font: 'display', size: 24, color: 'ink' });
    const hint = text(this, 842, 604, 'Enter — sign   ·   Esc — leave it', { size: 15, italic: true, color: 'wood3' }).setOrigin(1, 0);
    let name = lastName().slice(0, NAME_MAX);
    let blink = true;
    const draw = () => field.setText(`${name}${this.entering && blink ? '_' : ''}`);
    draw();
    const cursor = this.time.addEvent({ delay: 450, loop: true, callback: () => { blink = !blink; draw(); } });
    const finish = (signed: boolean) => {
      this.entering = false;
      this.signedAt = this.time.now;
      cursor.remove();
      footer.setAlpha(1);
      if (!signed) {
        draw();
        hint.setText('Left unsigned');
        return;
      }
      const who = name.trim() || 'Anonymous';
      rememberName(who);
      const entry = { name: who, money, verdict, date: today() };
      const at = signYear(year, entry);
      const parts = at >= 0 ? [`${ordinal(at + 1)} for ${year}`] : [];
      if (total != null) {
        const t = signTotal({ ...entry, money: total, verdict: '' });
        if (t >= 0) parts.push(`${ordinal(t + 1)} for the three years`);
      }
      name = who;
      draw();
      hint.setText(`Signed — ${parts.join(', ')}`).setColor('#2e4a2c');
      sfx('scratch');
    };
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (!this.entering) return;
      if (e.key === 'Enter') return finish(true);
      if (e.key === 'Escape') return finish(false);
      if (e.key === 'Backspace') name = name.slice(0, -1);
      else if (e.key.length === 1 && /[\p{L}\p{N} .'-]/u.test(e.key) && name.length < NAME_MAX) {
        name += e.key;
        sfx('scratch', { vol: 0.4, minGap: 0.04 });
      } else return;
      blink = true;
      draw();
    });
  }
}
