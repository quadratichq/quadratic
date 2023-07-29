import Color from 'color';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CellFormat } from '../../schemas';

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

  draw(rectangle: Rectangle, format: CellFormat): void {
    if (format) {
      if (format.fillColor) {
        const sprite = this.getSprite();
        const color = Color(format.fillColor);
        sprite.tint = color.rgbNumber();
        sprite.alpha = color.alpha();
        sprite.position.set(rectangle.x, rectangle.y);
        sprite.width = rectangle.width;
        sprite.height = rectangle.height;
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
