import Phaser from 'phaser';
import { registerTextures } from '../art/sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.image('plate', 'art/travies-ninety-leeches.jpg');
  }

  create() {
    registerTextures(this);
    // the period plate is a photograph of a lithograph: smooth it, unlike the pixel art
    if (this.textures.exists('plate')) this.textures.get('plate').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.scene.start('title');
  }
}
