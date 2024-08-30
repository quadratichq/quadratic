import { Container, Graphics, Rectangle } from 'pixi.js';

export class CellsHorizontalLines extends Container {
  clear() {
    this.removeChildren();
  }

  update(horizontalLines: Rectangle[]) {
    this.clear();
    horizontalLines.forEach((horizontalLine) => {
      const line = new Graphics()
        .beginFill(0x6cd4ff)
        .drawRect(horizontalLine.x, horizontalLine.y, horizontalLine.width, horizontalLine.height)
        .endFill();
      this.addChild(line);
    });
  }
}
