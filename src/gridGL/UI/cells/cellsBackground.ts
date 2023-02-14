import Color from 'color';
import { Container, Sprite, Texture } from 'pixi.js';
import { CellsDraw } from './Cells';

export class CellsBackground extends Container {
  private visibleIndex = 0;

  clear() {
    this.children.forEach((child) => (child.visible = false));
    this.visibleIndex = 0;
  }

  private getSprite(): Sprite {
    if (this.visibleIndex < this.children.length) {
      const sprite = this.children[this.visibleIndex] as Sprite;
      sprite.visible = true;
      this.visibleIndex++;
      return sprite;
    }
    this.visibleIndex++;
    return this.addChild(new Sprite(Texture.WHITE));
  }

  draw(input: CellsDraw): void {
    if (input.format) {
      if (input.format.fillColor) {
        const sprite = this.getSprite();
        const color = Color(input.format.fillColor);
        sprite.tint = color.rgbNumber();
        sprite.alpha = color.alpha();
        sprite.width = input.width;
        sprite.height = input.height;
        sprite.position.set(input.x, input.y);
      }
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsBackground] ${this.children.length} objects | ${
        this.children.filter((child) => child.visible).length
      } visible`
    );
  }
}
