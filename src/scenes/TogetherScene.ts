// Play together: your name, then a quick match (any public room with space), a private
// room (a code to give your friends), or a room whose code you've been given.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { sfx } from '../audio/audio';
import { playMusic } from '../audio/music';
import { fitCamera, text, panel, onType, STAGE } from '../ui/view';
import { soundButton } from '../ui/sound';
import { lastName, rememberName } from '../ui/board';
import { TOGETHER } from '../data/lines';
import { NetClient, SERVER, session, troubleOf } from '../net/client';
import { CODE_LENGTH, CODE_LETTERS, NAME_MAX, type Trouble } from '../net/protocol';

export class TogetherScene extends Phaser.Scene {
  private trouble: Trouble | null = null;

  constructor() {
    super('together');
  }

  init(data: { trouble?: Trouble }) {
    this.trouble = data?.trouble ?? (SERVER ? null : 'unset');
  }

  create() {
    fitCamera(this);
    soundButton(this, { key: () => false }); // every letter is typing here: click it instead
    playMusic('title');
    session.set(null);
    this.add.rectangle(0, 0, STAGE.w, STAGE.h, hex('ink')).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 90, 36, 1100, 648, 'paper1');
    text(this, 640, 66, TOGETHER.heading, { font: 'display', size: 46 }).setOrigin(0.5, 0);
    text(this, 640, 130, TOGETHER.subheading, { size: 20, italic: true, color: 'red1', wrap: 960, align: 'center' }).setOrigin(0.5, 0);

    const x = 210;
    text(this, x, 196, TOGETHER.nameLabel, { size: 17, italic: true, color: 'wood3' });
    panel(g, x - 12, 222, 520, 54, 'paper0');
    const nameField = text(this, x, 230, '', { font: 'display', size: 30 });
    const options = [TOGETHER.quick, TOGETHER.private, TOGETHER.join].map((s, i) => text(this, x, 316 + i * 46, s, { font: 'display', size: 26, color: 'red2' }));
    const codeLabel = text(this, x, 470, TOGETHER.codeLabel, { size: 17, italic: true, color: 'wood3' }).setVisible(false);
    const codeField = text(this, x, 496, '', { font: 'display', size: 40, color: 'ink' }).setVisible(false);
    const status = text(this, 640, 586, '', { size: 20, italic: true, color: 'red2', wrap: 960, align: 'center' }).setOrigin(0.5, 0);
    text(this, 640, 646, TOGETHER.back, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0);

    let name = lastName().slice(0, NAME_MAX);
    let code = '';
    let mode: 'menu' | 'code' | 'busy' = 'menu';
    let blink = true;
    const draw = () => {
      nameField.setText(`${name}${mode === 'menu' && blink ? '_' : ''}`);
      codeField.setText([...code.padEnd(CODE_LENGTH, '_')].join(' '));
      codeLabel.setVisible(mode === 'code' || (mode === 'busy' && code.length === CODE_LENGTH));
      codeField.setVisible(codeLabel.visible);
      for (const o of options) o.setAlpha(mode === 'busy' || !SERVER ? 0.4 : 1);
      if (this.trouble) status.setText(TOGETHER.trouble[this.trouble]).setColor('#9e2a24');
    };
    draw();
    this.time.addEvent({ delay: 450, loop: true, callback: () => ((blink = !blink), draw()) });

    // into a room, by whichever road; on success, the lobby
    const go = async (getCode: () => Promise<string>) => {
      if (!SERVER) return;
      mode = 'busy';
      this.trouble = null;
      status.setText(TOGETHER.connecting).setColor('#5e432b');
      draw();
      rememberName(name.trim());
      // quick match may hand out a seat that fills before we get there: ask again
      for (let tries = 0; tries < 3; tries++) {
        const net = new NetClient();
        try {
          await net.connect(await getCode(), name.trim());
          session.set(net);
          sfx('page');
          this.scene.start('lobby');
          return;
        } catch (e) {
          this.trouble = troubleOf(e);
          net.leave();
          if (this.trouble !== 'full' || getCode !== NetClient.match) break;
        }
      }
      if (!this.scene.isActive()) return;
      sfx('nope');
      mode = code.length ? 'code' : 'menu';
      draw();
    };

    onType(this, (e) => {
      if (mode === 'busy') return;
      if (e.key === 'Escape') {
        sfx('page');
        if (mode === 'code') {
          mode = 'menu';
          code = '';
          return draw();
        }
        return this.scene.start('title');
      }
      if (mode === 'code') {
        if (e.key === 'Backspace') code = code.slice(0, -1);
        else if (e.key === 'Enter' && code.length === CODE_LENGTH) return void go(async () => code);
        else if (e.key.length === 1 && CODE_LETTERS.includes(e.key.toUpperCase()) && code.length < CODE_LENGTH) {
          code += e.key.toUpperCase();
          sfx('scratch', { vol: 0.4, minGap: 0.04 });
        }
        return draw();
      }
      if (e.key === '1') return void go(NetClient.match);
      if (e.key === '2') return void go(NetClient.create);
      if (e.key === '3' && SERVER) {
        sfx('click');
        mode = 'code';
        return draw();
      }
      if (e.key === 'Backspace') name = name.slice(0, -1);
      else if (e.key.length === 1 && /[\p{L} .'-]/u.test(e.key) && name.length < NAME_MAX) {
        name += e.key;
        sfx('scratch', { vol: 0.4, minGap: 0.04 });
      } else return;
      blink = true;
      draw();
    });
  }
}
