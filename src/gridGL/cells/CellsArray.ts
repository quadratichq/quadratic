import { ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { CodeCellLanguage, JsRenderCodeCell } from '../../quadratic-core/quadratic_core';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';
import { CellsSheet } from './CellsSheet';
import { BorderCull, borderLineWidth, drawBorder, drawLine } from './drawBorders';

export class CellsArray extends ParticleContainer {
  private cellsSheet: CellsSheet;
  private lines: BorderCull[];

  constructor(cellsSheet: CellsSheet) {
    super(undefined, { vertices: true, tint: true }, undefined, true);
    this.cellsSheet = cellsSheet;
    this.lines = [];
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  create(): void {
    this.removeChildren();
    this.lines = [];
    const codeCells = this.cellsSheet.sheet.getRenderCodeCells();
    this.cellsSheet.cellsMarkers.clear();
    codeCells?.forEach((codeCell) => {
      this.draw(codeCell);
    });
  }

  cheapCull(bounds: Rectangle): void {
    this.lines.forEach((line) => (line.sprite.visible = intersects.rectangleRectangle(bounds, line.rectangle)));
  }

  private draw(codeCell: JsRenderCodeCell): void {
    const start = this.sheet.getCellOffsets(Number(codeCell.x), Number(codeCell.y));
    const end = this.sheet.getCellOffsets(Number(codeCell.x) + codeCell.w, Number(codeCell.y) + codeCell.h);
    const type = codeCell.language as CodeCellLanguage | string;
    let tint = colors.independence;
    if (type === CodeCellLanguage.Python || type === 'Python') {
      tint = colors.cellColorUserPython;
    } else if (type === CodeCellLanguage.Formula || type === 'Formula') {
      tint = colors.cellColorUserFormula;
    }

    this.lines.push(
      ...drawBorder({
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
      })
    );
    const right = end.x !== start.x + start.width;
    if (right) {
      this.lines.push(
        drawLine({
          x: start.x + start.width - borderLineWidth / 2,
          y: start.y + borderLineWidth / 2,
          width: borderLineWidth,
          height: start.height,
          alpha: 0.5,
          tint,
          getSprite: this.getSprite,
        })
      );
    }
    const bottom = end.y !== start.y + start.height;
    if (bottom) {
      this.lines.push(
        drawLine({
          x: start.x + borderLineWidth / 2,
          y: start.y + start.height - borderLineWidth / 2,
          width: start.width - borderLineWidth,
          height: borderLineWidth,
          alpha: 0.5,
          tint,
          getSprite: this.getSprite,
        })
      );
    }
    this.cellsSheet.cellsMarkers.add(start.x, start.y, codeCell.language, codeCell.state);
  }

  private getSprite = (): Sprite => {
    return this.addChild(new Sprite(Texture.WHITE));
  };
}
