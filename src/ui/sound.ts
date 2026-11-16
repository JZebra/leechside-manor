// The speaker in the corner of every screen: click it (or press M) to turn all the sound,
// music too, off or on. The choice is remembered in the browser (audio.ts).

import Phaser from 'phaser';
import { PIXEL } from '../art/palette';
import { sfx, isMuted, setMuted } from '../audio/audio';
import { SOUND } from '../data/lines';
import { text } from './view';

export interface SoundButtonOpts {
  x?: number; // its top-right corner, in stage px (default: the stage's top-right corner)
  y?: number;
  depth?: number;
  key?: () => boolean; // may M work just now? (not while a name is being typed)
}

export function soundButton(scene: Phaser.Scene, o: SoundButtonOpts = {}) {
  const { x = 1275, y = 9, depth = 1000 } = o;
  const icon = scene.add.image(x, y, 'icon:sound:on').setOrigin(1, 0).setScale(PIXEL).setDepth(depth);
  // what a click would do, shown while the pointer is over it
  const hint = text(scene, x, y + icon.displayHeight + 3, '', { size: 15, italic: true, color: 'paper1', stroke: 'ink', strokeWidth: 4 })
    .setOrigin(1, 0)
    .setDepth(depth)
    .setVisible(false);
  const show = () => {
    icon.setTexture(isMuted() ? 'icon:sound:off' : 'icon:sound:on');
    hint.setText(isMuted() ? SOUND.unmute : SOUND.mute);
  };
  const toggle = () => {
    setMuted(!isMuted());
    sfx('click');
    show();
  };
  // a pixel of slack all round, so the waves' gaps still count
  icon.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-1, -1, icon.width + 2, icon.height + 2),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });
  icon.on('pointerover', () => hint.setVisible(true));
  icon.on('pointerout', () => hint.setVisible(false));
  icon.on('pointerdown', toggle);
  scene.input.keyboard?.on('keydown-M', () => {
    if (!o.key || o.key()) toggle();
  });
  show();
  return icon;
}
