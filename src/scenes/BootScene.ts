import Phaser from 'phaser';
import { registerTextures } from '../art/sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.image('plate', 'art/bnf-fr127-galerius.jpg');
  }

  create() {
    registerTextures(this);
    // the period plate is a photograph of a manuscript page: smooth it, unlike the pixel art
    if (this.textures.exists('plate')) this.textures.get('plate').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.scene.start('title');
  }
}
