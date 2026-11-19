// Six o'clock: the day's report, with Broussais's verdict stamped on it. From here,
// the next day (or, after the third, what happened next). Online, it credits each doctor,
// and leads back to the room.

import Phaser from 'phaser';
import { CONFIG } from '../config';
import { hex, css, type PaletteKey } from '../art/palette';
import { OUTCOME_LABEL, VERDICT_REMARK, REPORT, REGISTER, ONLINE, LOBBY } from '../data/lines';
import { COATS } from '../art/sprites';
import { session, SERVER, type NetClient } from '../net/client';
import type { Report } from '../net/protocol';
import type { Ward } from '../model/ward';
import { sfx } from '../audio/audio';
import { fitCamera, text, panel, onType, STAGE } from '../ui/view';
import { soundButton } from '../ui/sound';
import { finishDay } from '../ui/progress';
import { loadBoard, qualifies, signYear, lastName, rememberName, today, ordinal, NAME_MAX, hasTicket, fetchBoard, signOnline } from '../ui/board';

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
  private visit = 0; // which showing of the report an answer from the server is for

  constructor() {
    super('results');
  }

  create(data: { ward: Ward; online?: { net: NetClient; report: Report } }) {
    fitCamera(this);
    soundButton(this, { key: () => !this.entering }); // not while signing the register
    this.entering = false;
    this.signedAt = -1e9;
    this.visit++;
    const ward = data.ward;
    const shift = ward.shift;
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 60, 36, 1160, 648, 'paper1');

    const online = data.online;
    const day = shift.day;
    const last = day === CONFIG.days.length - 1;
    // the run so far: each day's takings, kept while the game is open (playing alone)
    const run = (this.registry.get('run') as number[] | undefined) ?? [];
    if (!online) {
      run[day] = shift.money;
      this.registry.set('run', run);
    }
    const record = !online && finishDay(day, shift.money);

    text(this, 100, 62, REPORT.heading(ward.layout.name), { font: 'display', size: 40 });
    text(this, 102, 112, REPORT.subheading(shift.spec.year), { size: 18, italic: true, color: 'red1' });

    // the patients, in two columns
    const log = shift.log;
    const perCol = online ? 11 : 13; // online, the doctors' credits go underneath
    log.slice(0, perCol * 2).forEach((e, i) => {
      const col = Math.floor(i / perCol);
      const x = 100 + col * 400;
      const y = 156 + (i % perCol) * 30;
      const kind = REPORT.kind[e.type] ? ` ${REPORT.kind[e.type]}` : '';
      text(this, x, y, `${e.profile.rank} ${e.profile.surname}${kind}`, { size: 18 });
      text(this, x + 220, y + 1, OUTCOME_LABEL[e.outcome] ?? e.outcome, { size: 16, italic: true, color: OUTCOME_COLOUR[e.outcome] ?? 'wood3' });
      if (e.fee) text(this, x + 385, y, `${e.fee > 0 ? '+' : ''}${e.fee}`, { size: 18, color: e.fee > 0 ? 'ink' : 'red2' }).setOrigin(1, 0);
    });
    if (log.length > perCol * 2) text(this, 100, 156 + perCol * 30, REPORT.more(log.length - perCol * 2), { size: 16, italic: true, color: 'wood3' });
    if (!log.length) text(this, 100, 156, REPORT.nobody, { size: 20, italic: true });

    // the sums
    const counts = (o: string) => log.filter((e) => e.outcome === o).length;
    const lines = [
      `${REPORT.green}: ${counts('green')}`,
      `${REPORT.earlyLate}: ${counts('early') + counts('late')}`,
      `${REPORT.faint}: ${counts('faint')}`,
      `${REPORT.walkedOut}: ${counts('walkedOut')}`,
      `${REPORT.applied}: ${ward.applied}`,
      `${REPORT.lost}: ${ward.lost}${ward.slips ? REPORT.squashed(ward.slips) : ''}`,
      `${REPORT.floor}: ${ward.floorAtBell}`,
    ];
    text(this, 920, 156, lines.join('\n'), { size: 18, lineSpacing: 6 });
    text(this, 920, 372, REPORT.takings(shift.money), { font: 'display', size: 30, color: shift.money >= 0 ? 'ink' : 'red2' });
    const v = online?.report.thresholds ?? shift.thresholds;
    if (record) text(this, 1196, 344, REPORT.newBest, { size: 16, italic: true, color: 'red2' }).setOrigin(1, 0);
    text(this, 922, 412, REPORT.thresholds(v.approved, v.noted), { size: 15, italic: true, color: 'wood3' });

    // Broussais's stamp, thumped down in steps
    const verdict = online?.report.verdict ?? shift.verdict();
    const ink: PaletteKey = verdict === 'APPROVED' ? 'stamp0' : 'red2';
    const stamp = this.add.container(1060, 510);
    const word = text(this, 0, 2, REPORT.stamp[verdict], { font: 'display', size: 44, color: ink }).setOrigin(0.5);
    const sg = this.add.graphics();
    const sw = Math.ceil((word.width + 60) / 6) * 6, sh = 84;
    sg.fillStyle(hex(ink)).fillRect(-sw / 2, -sh / 2, sw, sh);
    sg.fillStyle(hex('paper1')).fillRect(-sw / 2 + 6, -sh / 2 + 6, sw - 12, sh - 12);
    sg.fillStyle(hex(ink)).fillRect(-sw / 2 + 12, -sh / 2 + 12, sw - 24, sh - 24);
    sg.fillStyle(hex('paper1')).fillRect(-sw / 2 + 15, -sh / 2 + 15, sw - 30, sh - 30);
    stamp.add(sg);
    stamp.add(word);
    stamp.setScale(1.6).setVisible(false);
    text(this, 920, 572, VERDICT_REMARK[verdict], { size: 18, italic: true, wrap: 280, color: 'wood2' });
    text(this, 1196, 648, REPORT.signature, { size: 16, italic: true, color: 'wood3' }).setOrigin(1, 0);

    this.time.delayedCall(700, () => {
      stamp.setVisible(true);
      this.tweens.add({ targets: stamp, scale: 1, duration: 160, ease: 'Stepped', easeParams: [3], onComplete: () => sfx('stamp') });
    });

    if (online) return this.together(online.net, online.report);

    const next = last ? REPORT.epilogue : REPORT.next(CONFIG.days[day + 1].title);
    const footer = text(this, 100, 648, `${next}   ·   ${REPORT.retry}   ·   ${REPORT.title}`, { font: 'display', size: 22, color: 'red2' });
    const kb = this.input.keyboard!;
    const idle = () => this.entering || this.time.now - this.signedAt < 300; // the Enter that signs mustn't also leave
    const go = () => {
      if (idle()) return;
      sfx('page');
      if (last) {
        // the three years' takings, or 1832's alone if the run didn't start in 1828
        const whole = run.filter((x) => x != null).length === CONFIG.days.length;
        this.scene.start('epilogue', { francs: whole ? run.reduce((a, b) => a + b, 0) : shift.money });
      }
      else this.scene.start('ward', { day: day + 1 });
    };
    this.time.delayedCall(800, () => {
      kb.on('keydown-E', go);
      kb.on('keydown-SPACE', go);
      kb.on('keydown-ENTER', go);
      kb.on('keydown-R', () => !idle() && this.scene.start('ward', { day }));
      kb.on('keydown-T', () => !idle() && this.scene.start('title'));
    });

    // the register: sign for this year's top ten, in this browser and (with a ticket for the
    // day) online, if the takings make either
    const year = shift.spec.year;
    const here = qualifies(loadBoard().years[String(year)] ?? [], shift.money);
    const sign = (online: boolean) => this.signing({ day, year, money: shift.money, verdict, here, online }, footer);
    if (!hasTicket(day)) {
      if (here) sign(false);
      return;
    }
    const visit = this.visit;
    fetchBoard().then((b) => {
      if (visit !== this.visit || !this.sys.isActive()) return; // he's moved on
      const online = !!b && qualifies(b.years[String(year)] ?? [], shift.money);
      if (here || online) sign(online);
    });
  }

  // Online: each doctor's share of the day, then back to the room (or away).
  private together(net: NetClient, report: Report) {
    const cols = [100, 330, 450, 560, 670, 780];
    const head = ONLINE.credits;
    head.forEach((h, i) => text(this, cols[i], 506, h, { size: 15, italic: true, color: 'wood3' }));
    report.credits.forEach((c, row) => {
      const y = 530 + row * 26;
      const cells = [c.name, c.green, c.faints, c.squashed, c.knocked, c.carried];
      cells.forEach((v, i) => text(this, cols[i], y, String(v), { size: 18, color: i ? 'ink' : COATS[c.slot][0], font: i ? 'body' : 'display' }));
    });
    text(this, 100, 648, `${ONLINE.toLobby}   ·   ${LOBBY.leave}`, { font: 'display', size: 22, color: 'red2' });
    const kb = this.input.keyboard!;
    const back = () => {
      sfx('page');
      this.scene.start('lobby');
    };
    this.time.delayedCall(800, () => {
      kb.on('keydown-E', back);
      kb.on('keydown-SPACE', back);
      kb.on('keydown-ENTER', back);
      kb.on('keydown-ESC', () => {
        sfx('page');
        session.set(null);
        this.scene.start('title');
      });
    });
    const stop = net.onTrouble((t) => this.scene.start('together', { trouble: t }));
    this.events.once('shutdown', stop);
  }

  // A place on the board: type a name (Enter signs, Esc leaves it unsigned).
  private signing(
    s: { day: number; year: number; money: number; verdict: string; here: boolean; online: boolean },
    footer: Phaser.GameObjects.Text,
  ) {
    const { day, year, money, verdict } = s;
    const visit = this.visit;
    this.entering = true;
    footer.setAlpha(0.35);
    const g = this.add.graphics();
    panel(g, 100, 566, 760, 66, 'paper0');
    text(this, 118, 574, REGISTER.prompt(year), { size: 18, italic: true, color: 'red1' });
    const field = text(this, 118, 598, '', { font: 'display', size: 24, color: 'ink' });
    const hint = text(this, 842, 604, REGISTER.keys, { size: 15, italic: true, color: 'wood3' }).setOrigin(1, 0);
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
        hint.setText(REGISTER.unsigned);
        return;
      }
      const who = name.trim() || REGISTER.anonymous;
      rememberName(who);
      name = who;
      draw();
      const report = (words: string, ok: boolean) => {
        hint.setText(words).setColor(css(ok ? 'stamp0' : 'red2'));
        if (ok) sfx('scratch');
      };
      const local = s.here ? signYear(year, { name: who, money, verdict, date: today() }) : -1;
      const localWords = (at: number) => (SERVER ? REGISTER.signedHere : REGISTER.signed)(ordinal(at + 1), year);
      if (!s.online) return report(local >= 0 ? localWords(local) : REGISTER.unsigned, local >= 0);
      hint.setText(REGISTER.sending);
      signOnline(day, who, money).then((at) => {
        if (visit !== this.visit || !this.sys.isActive()) return;
        if (at !== null && at >= 0) report(REGISTER.signed(ordinal(at + 1), year), true);
        else if (local >= 0) report(localWords(local), true);
        else report(at === null ? REGISTER.unreachable : REGISTER.unsigned, false);
      });
    };
    onType(this, (e) => {
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
