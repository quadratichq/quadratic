import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { CellsTextHash } from './CellsTextHash';
import { JsBorderHorizontal, JsBorders, JsBorderVertical } from '@/app/quadratic-core-types';
import { setBorderTexture } from '../drawBorders';
import { sheets } from '@/app/grid/controller/Sheets';
import { Bounds } from '@/app/grid/sheet/Bounds';
import { convertRgbaToTint } from '@/app/helpers/convertColor';
import { Sheet } from '@/app/grid/sheet/Sheet';

export class CellsHashBorders extends Container {
  private cellsTextHash: CellsTextHash;

  private horizontal?: JsBorderHorizontal[];
  private vertical?: JsBorderVertical[];

  bounds: Bounds;

  // This may be constructed after a bordersHash event has been received
  constructor(cellsTextHash: CellsTextHash) {
    super();
    this.cellsTextHash = cellsTextHash;
    this.bounds = new Bounds();
  }

  private drawBorder(border: JsBorderHorizontal | JsBorderVertical, sheet: Sheet) {
    // We don't draw clear borders, but we do mark it as a border so it
    // overrides the all, columns, and rows borders.
    if (border.line === 'clear') {
      return;
    }

    const isHorizontal = (border as JsBorderHorizontal).width !== undefined;

    const borderType = border.line;
    const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;
    const tiling = borderType === 'dashed' || borderType === 'dotted';
    const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

    const sprite = this.getSprite(tiling);
    setBorderTexture(sprite, isHorizontal, borderType);
    const { tint, alpha } = convertRgbaToTint(border.color);
    sprite.tint = tint;
    sprite.alpha = alpha ?? 1;
    const start = sheet.getCellOffsets(border.x, border.y);

    if (isHorizontal) {
      const borderHorizontal = border as JsBorderHorizontal;
      const end = sheet.getCellOffsets(Number(borderHorizontal.x + borderHorizontal.width) - 1, borderHorizontal.y);
      sprite.width = end.x + end.width - start.x + 1;
      sprite.height = lineWidth;
      sprite.position.set(start.x - lineWidth / 2, start.y - lineWidth / 2);
    } else {
      const borderVertical = border as JsBorderVertical;
      const end = sheet.getCellOffsets(borderVertical.x, Number(borderVertical.y + borderVertical.height) - 1);
      sprite.width = lineWidth;
      sprite.height = end.y + end.height - start.y + 1;
      sprite.position.set(start.x - lineWidth / 2, start.y - lineWidth / 2);
    }

    this.addChild(sprite);
    this.bounds.addRectanglePoints(sprite.x, sprite.y, sprite.width, sprite.height);

    // Creates a double border
    if (doubleDistance) {
      const doubleSprite = this.getSprite(tiling);
      setBorderTexture(doubleSprite, isHorizontal, borderType);
      doubleSprite.tint = tint;
      doubleSprite.alpha = alpha ?? 1;

      if (isHorizontal) {
        doubleSprite.width = start.width + lineWidth + 1;
        doubleSprite.height = lineWidth;
        doubleSprite.position.set(start.x - lineWidth / 2, start.y + doubleDistance - lineWidth / 2);
      } else {
        doubleSprite.width = lineWidth;
        doubleSprite.height = start.height + lineWidth + 1;
        doubleSprite.position.set(start.x - lineWidth / 2 + doubleDistance, start.y - lineWidth / 2);
      }
      this.addChild(doubleSprite);
      this.bounds.addRectanglePoints(doubleSprite.x, doubleSprite.y, doubleSprite.width, doubleSprite.height);
    }
  }

  update(borders: JsBorders) {
    this.bounds.clear();
    this.horizontal = borders.horizontal;
    this.vertical = borders.vertical;
    this.draw();
  }

  private draw() {
    this.removeChildren();
    const sheet = sheets.getById(this.cellsTextHash.sheetId);
    if (!sheet) return;

    this.horizontal?.forEach((border) => this.drawBorder(border, sheet));
    this.vertical?.forEach((border) => this.drawBorder(border, sheet));

    this.cellsTextHash.updateHashBounds();
  }

  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    return this.addChild(tiling ? new TilingSprite(Texture.WHITE) : new Sprite(Texture.WHITE));
  };
}
