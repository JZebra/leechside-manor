// The room before the doors open: the code to share, who's in (each in his own coat),
// who's ready, and the year (the host chooses). Everyone ready, and three seconds later
// the game begins; after each day's report the players come back here.

import Phaser from 'phaser';
import { hex, css } from '../art/palette';
import { COATS } from '../art/sprites';
import { sfx } from '../audio/audio';
import { playMusic } from '../audio/music';
import { fitCamera, text, panel, STAGE } from '../ui/view';
import { soundButton } from '../ui/sound';
import { CONFIG } from '../config';
import { LOBBY, YEAR_TITLE } from '../data/lines';
import { session } from '../net/client';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('lobby');
  }

  create() {
    fitCamera(this);
    soundButton(this);
    playMusic('title');
    const net = session.get();
    if (!net) return void this.scene.start('together');
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 90, 36, 1100, 648, 'paper1');

    const heading = text(this, 640, 56, LOBBY.room(net.code), { font: 'display', size: 54 }).setOrigin(0.5, 0);
    const sub = text(this, 640, 128, '', { size: 19, italic: true, color: 'red1' }).setOrigin(0.5, 0);
    const rows = [0, 1, 2, 3].map((slot) => {
      const y = 180 + slot * 72;
      return {
        doc: this.add.image(214, y + 4, `doc:${slot}:down:0`).setOrigin(0.5, 0).setScale(3),
        name: text(this, 260, y + 10, '', { font: 'display', size: 30 }),
        role: text(this, 262, y + 44, '', { size: 15, italic: true, color: 'wood3' }),
        ready: text(this, 1080, y + 18, '', { font: 'display', size: 24 }).setOrigin(1, 0),
      };
    });
    const years = CONFIG.days.map((d, i) => text(this, 300 + i * 340, 488, `${i + 1}  ${YEAR_TITLE[d.year]}`, { size: 19 }).setOrigin(0.5, 0));
    const yearHint = text(this, 640, 520, '', { size: 15, italic: true, color: 'wood3' }).setOrigin(0.5, 0);
    const status = text(this, 640, 566, '', { font: 'display', size: 28, color: 'red2' }).setOrigin(0.5, 0);
    const keys = text(this, 640, 646, '', { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);
    void heading;

    let lastCount = -1;
    const draw = () => {
      const lobby = net.lobby;
      if (!lobby) return;
      const me = lobby.players.find((p) => p.id === net.you);
      const host = lobby.players.find((p) => p.host);
      sub.setText(lobby.public ? LOBBY.public : LOBBY.private);
      rows.forEach((r, slot) => {
        const p = lobby.players.find((x) => x.slot === slot);
        r.doc.setAlpha(p ? 1 : 0.18);
        r.name.setText(p ? `${p.name}${p.id === net.you ? `  ${LOBBY.you}` : ''}` : LOBBY.empty).setColor(css(p ? COATS[slot][0] : 'paper4')); // in the colour of his coat
        r.role.setText(p?.host ? LOBBY.host : '');
        r.ready.setText(p ? (p.ready ? LOBBY.ready : LOBBY.notReady) : '').setColor(css(p?.ready ? 'stamp0' : 'paper4'));
      });
      years.forEach((t, i) => t.setColor(css(i === lobby.day ? 'red2' : 'paper4')).setFontStyle(i === lobby.day ? 'bold' : ''));
      yearHint.setText(me?.host ? LOBBY.yearHost : host ? LOBBY.yearOther(host.name) : '');
      const counting = lobby.phase === 'countdown';
      status.setText(counting ? LOBBY.countdown(lobby.countdown) : LOBBY.waiting);
      if (counting && lobby.countdown !== lastCount) sfx('tick');
      lastCount = counting ? lobby.countdown : -1;
      keys.setText(`${me?.ready ? LOBBY.unreadyKey : LOBBY.readyKey}   ·   ${LOBBY.leave}`);
    };
    draw();

    const stop = [
      net.on((m) => {
        if (m.t === 'lobby') draw();
        if (m.t === 'start') {
          net.hold();
          sfx('page');
          this.scene.start('ward', { online: { net, day: m.day, seed: m.seed, seats: m.seats } });
        }
      }),
      net.onTrouble((t) => this.scene.start('together', { trouble: t })),
    ];
    this.events.once('shutdown', () => stop.forEach((f) => f()));

    const kb = this.input.keyboard!;
    const pickYear = (day: number) => {
      const me = net.lobby?.players.find((p) => p.id === net.you);
      if (!me?.host || day < 0 || day >= CONFIG.days.length) return;
      sfx('click');
      net.send({ t: 'day', day });
    };
    kb.on('keydown-SPACE', () => {
      const me = net.lobby?.players.find((p) => p.id === net.you);
      sfx('click');
      net.send({ t: 'ready', ready: !me?.ready });
    });
    kb.on('keydown-ONE', () => pickYear(0));
    kb.on('keydown-TWO', () => pickYear(1));
    kb.on('keydown-THREE', () => pickYear(2));
    kb.on('keydown-LEFT', () => pickYear((net.lobby?.day ?? 0) - 1));
    kb.on('keydown-RIGHT', () => pickYear((net.lobby?.day ?? 0) + 1));
    kb.on('keydown-ESC', () => {
      sfx('page');
      session.set(null);
      this.scene.start('title');
    });
  }
}
