import Phaser from 'phaser';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import { css } from './art/palette';
import { STAGE, RES } from './ui/view';
import { installAudioUnlock } from './audio/audio';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WardScene } from './scenes/WardScene';
import { ResultsScene } from './scenes/ResultsScene';

async function fonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('32px "IM Fell English"'),
        document.fonts.load('italic 32px "IM Fell English"'),
        document.fonts.load('20px "EB Garamond"'),
        document.fonts.load('italic 20px "EB Garamond"'),
        document.fonts.load('600 20px "EB Garamond"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)), // never hang on a missing font
    ]);
  } catch {
    /* fall back to Georgia */
  }
}

fonts().then(() => {
  installAudioUnlock();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: STAGE.w * RES,
    height: STAGE.h * RES,
    backgroundColor: css('ink'),
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, WardScene, ResultsScene],
  });
  (window as unknown as { game: Phaser.Game }).game = game;
});
