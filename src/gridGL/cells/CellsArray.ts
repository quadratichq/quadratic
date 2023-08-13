import { ParticleContainer, Sprite, Texture } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { JsRenderCodeCell } from '../../quadratic-core/types';
import { colors } from '../../theme/colors';
import { CellsSheet } from './CellsSheet';
import { borderLineWidth, drawBorder, drawLine } from './drawBorders';

export class CellsArray extends ParticleContainer {
  private cellsSheet: CellsSheet;

  constructor(cellsSheet: CellsSheet) {
    super(undefined, { vertices: true, tint: true }, undefined, true);
    this.cellsSheet = cellsSheet;
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  create(): void {
    this.removeChildren();

    const codeCells = this.cellsSheet.sheet.grid.getRenderCodeCells();
    this.cellsSheet.cellsMarkers.clear();
    codeCells?.forEach((codeCell) => {
      this.draw(codeCell);
    });
  }

  draw(codeCell: JsRenderCodeCell): void {
    const { gridOffsets } = this.sheet;
    const start = gridOffsets.getCell(Number(codeCell.x), Number(codeCell.y));
    const end = gridOffsets.getCell(Number(codeCell.x) + codeCell.w, Number(codeCell.y) + codeCell.h);
    const type = codeCell.language;
    let tint = colors.independence;
    if (type === 'Python') {
      tint = colors.cellColorUserPython;
    } else if (type === 'Formula') {
      tint = colors.cellColorUserFormula;
    }
    // : type === 'AI'
    // ? colors.cellColorUserAI
    // : colors.independence,

    drawBorder({
      alpha: 0.5,
      tint,
      x: start.x,
      y: start.y,
      width: end.x - start.x,
      height: end.y - start.y,
      getSprite: this.getSprite,
      top: true,
      left: true,
      bottom: true,
      right: true,
    });
    const right = end.x !== start.x + start.width;
    if (right) {
      drawLine({
        x: start.x + start.width - borderLineWidth / 2,
        y: start.y + borderLineWidth / 2,
        width: borderLineWidth,
        height: start.height,
        alpha: 0.5,
        tint,
        getSprite: this.getSprite,
      });
    }
    const bottom = end.y !== start.y + start.height;
    if (bottom) {
      drawLine({
        x: start.x + borderLineWidth / 2,
        y: start.y + start.height - borderLineWidth / 2,
        width: start.width - borderLineWidth,
        height: borderLineWidth,
        alpha: 0.5,
        tint,
        getSprite: this.getSprite,
      });
    }
    this.cellsSheet.cellsMarkers.add(start.x, start.y, type, false);
  }

  // clear() {
  //   this.children.forEach((child) => (child.visible = false));
  //   this.visibleIndex = 0;
  // }

  private getSprite = (): Sprite => {
    return this.addChild(new Sprite(Texture.WHITE));
  };

  // draw(cellArray: number[][], x: number, y: number, width: number, height: number, type: CellType): void {
  //   const { gridOffsets } = this.app.sheet;

  //   // calculate array cells outline size
  //   let xEnd = x + width;
  //   let yEnd = y + height;
  //   for (let i = 0; i < cellArray.length; i++) {
  //     const arrayCells = cellArray[i];
  //     const xPlacement = gridOffsets.getColumnPlacement(arrayCells[0]);
  //     xEnd = Math.max(xPlacement.x + xPlacement.width, xEnd);
  //     const yPlacement = gridOffsets.getRowPlacement(arrayCells[1]);
  //     yEnd = Math.max(yPlacement.y + yPlacement.height, yEnd);
  //   }

  //   drawBorder({
  //     tint:
  //       type === 'PYTHON'
  //         ? colors.cellColorUserPython
  //         : type === 'FORMULA'
  //         ? colors.cellColorUserFormula
  //         : type === 'AI'
  //         ? colors.cellColorUserAI
  //         : colors.independence,
  //     alpha: 0.5,
  //     x,
  //     y,
  //     width: xEnd - x,
  //     height: yEnd - y,
  //     getSprite: this.getSprite,
  //     top: true,
  //     left: true,
  //     bottom: true,
  //     right: true,
  //   });
  // }

  // debugShowCachedCounts(): void {
  //   console.log(
  //     `[CellsArray] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
  //   );
  // }
}
