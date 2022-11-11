import { Container, Sprite, Texture } from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { PixiApp } from '../../pixiApp/PixiApp';
import { ICellsDraw } from './Cells';

export class CellsBorder extends Container {
  private app: PixiApp;
  private visibleIndex = 0;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  clear() {
    this.children.forEach(child => child.visible = false);
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

  drawBorder(input: ICellsDraw, tint: number, alpha: number): void {
    const top = this.getSprite();
    top.tint = tint;
    top.alpha = alpha;
    top.width = input.width;
    top.height = 1;
    top.position.set(input.x, input.y);

    const bottom = this.getSprite();
    bottom.tint = tint;
    bottom.alpha = alpha;
    bottom.width = input.width;
    bottom.height = 1;
    bottom.position.set(input.x, input.y + input.height - 1);

    const left = this.getSprite();
    left.tint = tint;
    left.alpha = alpha;
    left.width = 1;
    left.height = input.height;
    left.position.set(input.x, input.y);

    const right = this.getSprite();
    right.tint = tint;
    right.alpha = alpha;
    right.width = 1;
    right.height = input.height;
    right.position.set(input.x + input.width - 1, input.y);
  }

  draw(input: ICellsDraw): void {
    if (!input.cell || !this.app.settings.showCellTypeOutlines) return;

    // Change outline color based on cell type but don't draw TEXT cell outlines since it's handled by the grid
    if (input.cell.type === 'TEXT') {
      this.drawBorder(input, colors.cellColorUserText, 0.75);
    } else if (input.cell.type === 'PYTHON') {
      this.drawBorder(input, colors.cellColorUserPython, 0.75);
    } else if (input.cell.type === 'COMPUTED') {
      this.drawBorder(input, colors.independence, 0.75);
    }
  }
}