import { sheets } from '@/grid/controller/Sheets';
import { JsRenderBorders } from '@/quadratic-core-types';
import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { CellsSheet } from './CellsSheet';
import { BorderCull, drawCellBorder } from './drawBorders';

export class CellsBorders extends Container {
  private cellsSheet: CellsSheet;
  private sprites: BorderCull[];

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.sprites = [];
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsBorders.sheet`);
    return sheet;
  }

  clear(): void {
    this.removeChildren();
  }

  drawHorizontal(borders: JsRenderBorders) {
    for (const border of borders.horizontal) {
      if (border.w === undefined) throw new Error('Expected border.w to be defined in CellsBorders.drawHorizontal');
      const start = this.sheet.offsets.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.offsets.getCellOffsets(Number(border.x) + border.w, Number(border.y));
      const color = border.style.color;
      this.sprites.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          horizontal: { type: border.style.line, color },
          getSprite: this.getSprite,
        })
      );
    }
  }

  drawVertical(borders: JsRenderBorders) {
    for (const border of borders.vertical) {
      if (border.h === undefined) throw new Error('Expected border.h to be defined in CellsBorders.drawVertical');
      const start = this.sheet.offsets.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.offsets.getCellOffsets(Number(border.x), Number(border.y) + border.h!);
      const color = border.style.color;
      this.sprites.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          vertical: { type: border.style.line, color },
          getSprite: this.getSprite,
        })
      );
    }
  }

  create(): void {
    this.clear();
    // const borders = grid.getRenderBorders(this.sheet.id);
    // this.drawHorizontal(borders);
    // this.drawVertical(borders);
    // borders.free();
  }

  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      return this.addChild(new TilingSprite(Texture.WHITE));
    } else {
      return this.addChild(new Sprite(Texture.WHITE));
    }
  };
}
