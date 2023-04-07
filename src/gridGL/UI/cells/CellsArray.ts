import { Container, Sprite, Texture } from 'pixi.js';
import { CellTypes } from '../../../grid/sheet/gridTypes';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../../pixiApp/PixiApp';
import { drawBorder } from './drawBorder';

export class CellsArray extends Container {
  private app: PixiApp;
  private visibleIndex = 0;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  clear() {
    this.children.forEach((child) => (child.visible = false));
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
  };

  draw(cellArray: number[][], x: number, y: number, width: number, height: number, type: CellTypes): void {
    const { gridOffsets } = this.app.sheet;

    // calculate array cells outline size
    let xEnd = x + width;
    let yEnd = y + height;
    for (let i = 0; i < cellArray.length; i++) {
      const arrayCells = cellArray[i];
      const xPlacement = gridOffsets.getColumnPlacement(arrayCells[0]);
      xEnd = Math.max(xPlacement.x + xPlacement.width, xEnd);
      const yPlacement = gridOffsets.getRowPlacement(arrayCells[1]);
      yEnd = Math.max(yPlacement.y + yPlacement.height, yEnd);
    }

    drawBorder({
      tint:
        type === 'PYTHON'
          ? colors.cellColorUserPython
          : type === 'FORMULA'
          ? colors.cellColorUserFormula
          : type === 'AI'
          ? colors.cellColorUserAI
          : type === 'SQL'
          ? colors.cellColorUserSQL
          : colors.independence,
      alpha: 0.5,
      x,
      y,
      width: xEnd - x,
      height: yEnd - y,
      getSprite: this.getSprite,
      top: true,
      left: true,
      bottom: true,
      right: true,
    });
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsArray] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
