import Color from 'color';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { Cell, CellFormat } from '../../../gridDB/db';
import { PixiApp } from '../../pixiApp/PixiApp';

export interface ICellsDraw {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: Cell;
  format?: CellFormat;
}

export class CellsDraw extends Container {
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

  getSprite(): Sprite {
    if (this.visibleIndex < this.children.length) {
      const sprite = this.children[this.visibleIndex] as Sprite;
      sprite.visible = true;
      this.visibleIndex++;
      return sprite;
    }
    this.visibleIndex++;
    return this.addChild(new Sprite(Texture.WHITE));
  }

  draw(input: ICellsDraw, graphics: Graphics): void {
    if (input.format) {
      if (input.format.fillColor) {
        const color = Color(input.format.fillColor);
        graphics.beginFill(color.rgbNumber(), color.alpha());
        graphics.drawRect(0, 0, input.width, input.height);
        graphics.endFill();
      }
    }

    if (!input.cell || !this.app.settings.showCellTypeOutlines) return;

    // Change outline color based on cell type but don't draw TEXT cell outlines since it's handled by the grid
    if (input.cell.type === 'TEXT') {
      graphics.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);
    } else if (input.cell.type === 'PYTHON') {
      graphics.lineStyle(1, colors.cellColorUserPython, 0.75, 0.5, true);
    } else if (input.cell.type === 'COMPUTED') {
      graphics.lineStyle(1, colors.independence, 0.75, 0.5, true);
    }

    // Draw outline
    graphics.drawRect(0, 0, input.width, input.height);
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

  add(input: ICellsDraw): void {
    if (input.format) {
      if (input.format.fillColor) {
        const sprite = this.getSprite();
        const color = Color(input.format.fillColor);
        sprite.tint = color.rgbNumber();
        sprite.alpha = color.alpha();
        sprite.width = input.width;
        sprite.height = input.height;
        sprite.position.set(input.x, input.y)
      }
    }

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