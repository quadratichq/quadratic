import { Container, Sprite, Texture } from 'pixi.js';
import { convertColorStringToTint } from '../../../../helpers/convertColor';
import { colors } from '../../../../theme/colors';
import { borderBottom, borderLeft, borderRight, borderTop } from '../../../gridDB/db';
import { PixiApp } from '../../pixiApp/PixiApp';
import { ICellsDraw } from './Cells';
import { drawBorder } from './drawBorder';

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

  private getSprite = (): Sprite => {
    if (this.visibleIndex < this.children.length) {
      const sprite = this.children[this.visibleIndex] as Sprite;
      sprite.visible = true;
      this.visibleIndex++;
      return sprite;
    }
    this.visibleIndex++;
    return this.addChild(new Sprite(Texture.WHITE));
  }

  draw(input: ICellsDraw): void {
    if (!this.app.settings.showCellTypeOutlines) return;

    const drawInputBorder = (input: ICellsDraw, tint: number, alpha: number): void => {
      drawBorder({
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        tint,
        alpha,
        getSprite: this.getSprite,
        top: true,
        bottom: true,
        left: true,
        right: true,
      });
    }

    if (input.cell) {
      // Change outline color based on cell type
      if (input.cell.type === 'TEXT') {
        drawInputBorder(input, colors.cellColorUserText, 0.75);
      } else if (input.cell.type === 'PYTHON') {
        drawInputBorder(input, colors.cellColorUserPython, 0.75);
      } else if (input.cell.type === 'COMPUTED') {
        drawInputBorder(input, colors.independence, 0.75);
      }
    }

    const border = input.format?.border;
    if (border) {
      drawBorder({
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        tint: input.format?.borderColor ? convertColorStringToTint(input.format.borderColor) : colors.defaultBorderColor,
        alpha: 1,
        getSprite: this.getSprite,
        left: !!(border & borderLeft),
        right: !!(border & borderRight),
        top: !!(border & borderTop),
        bottom: !!(border & borderBottom),
      });
    }
  }

  debugShowCachedCounts(): void {
    console.log(`[CellsBorder] ${this.children.length} objects | ${this.children.filter(child => child.visible).length} visible`);
  }
}