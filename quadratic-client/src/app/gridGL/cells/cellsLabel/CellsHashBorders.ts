import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { CellsTextHash } from './CellsTextHash';
import { JsBorderHorizontal, JsBorders, JsBorderVertical } from '@/app/quadratic-core-types';
import { BorderCull, setBorderTexture } from '../drawBorders';
import { sheets } from '@/app/grid/controller/Sheets';
import { Bounds } from '@/app/grid/sheet/Bounds';
import { convertRgbaToTint } from '@/app/helpers/convertColor';
import { Sheet } from '@/app/grid/sheet/Sheet';

export class CellsHashBorders extends Container {
  private cellsTextHash: CellsTextHash;
  private sprites: BorderCull[] = [];

  private horizontal?: JsBorderHorizontal[];
  private vertical?: JsBorderVertical[];

  bounds: Bounds;

  // This may be constructed after a bordersHash event has been received
  constructor(cellsTextHash: CellsTextHash) {
    super();
    this.cellsTextHash = cellsTextHash;
    this.bounds = new Bounds();
  }

  private drawHorizontalBorder(border: JsBorderHorizontal, sheet: Sheet) {
    const borderType = border.line;
    const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;
    const tiling = borderType === 'dashed' || borderType === 'dotted';
    const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

    const top = this.getSprite(tiling);
    setBorderTexture(top, true, borderType);
    const { tint, alpha } = convertRgbaToTint(border.color);
    top.tint = tint;
    top.alpha = alpha ?? 1;
    const start = sheet.getCellOffsets(border.x, border.y);
    const end = sheet.getCellOffsets(Number(border.x + border.width) - 1, border.y);

    top.width = end.x + end.width - start.x;
    top.height = lineWidth;
    top.position.set(start.x - lineWidth / 2, start.y - lineWidth / 2);
    this.sprites.push({
      sprite: top,
      rectangle: new Rectangle(top.x, top.y, top.width, top.height),
    });
    if (doubleDistance) {
      const top = this.getSprite(tiling);
      setBorderTexture(top, true, borderType);
      top.tint = tint;
      top.width = start.width + lineWidth; // todo - ((options.left ? 1 : 0) + (options.right ? 1 : 0)) * doubleDistance;
      top.height = lineWidth;
      top.position.set(
        start.x - lineWidth / 2, // todo + (options.left ? doubleDistance : 0),
        start.y + doubleDistance - lineWidth / 2
      );
      this.sprites.push({
        sprite: top,
        rectangle: new Rectangle(top.x, top.y, top.width, top.height),
      });
    }
  }

  private drawVerticalBorder(border: JsBorderVertical, sheet: Sheet) {
    const borderType = border.line;
    const lineWidth = borderType === 'line2' ? 2 : borderType === 'line3' ? 3 : 1;
    const tiling = borderType === 'dashed' || borderType === 'dotted';
    const doubleDistance = borderType === 'double' ? lineWidth * 2 : 0;

    const left = this.getSprite(tiling);
    setBorderTexture(left, false, borderType);
    const { tint, alpha } = convertRgbaToTint(border.color);
    left.tint = tint;
    left.alpha = alpha ?? 1;
    const start = sheet.getCellOffsets(border.x, border.y);
    const end = sheet.getCellOffsets(border.x, Number(border.y + border.height) - 1);

    left.width = lineWidth;
    left.height = end.y + end.height - start.y;
    left.position.set(start.x - lineWidth / 2, start.y - lineWidth / 2);
    this.sprites.push({
      sprite: left,
      rectangle: new Rectangle(left.x, left.y, left.width, left.height),
    });

    if (doubleDistance) {
      const left = this.getSprite(tiling);
      setBorderTexture(left, false, borderType);
      left.tint = tint;
      left.width = lineWidth;
      left.height = start.height + lineWidth; // todo - ((options.top ? 1 : 0) + (options.bottom ? 1 : 0)) * doubleDistance;
      left.position.set(
        start.x - lineWidth / 2 + doubleDistance,
        start.y - lineWidth / 2 // todo + (options.top ? doubleDistance : 0)
      );
      this.sprites.push({
        sprite: left,
        rectangle: new Rectangle(left.x, left.y, left.width, left.height),
      });
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

    this.horizontal?.forEach((border) => {
      this.drawHorizontalBorder(border, sheet);
    });

    this.vertical?.forEach((border) => {
      this.drawVerticalBorder(border, sheet);
    });

    this.sprites.forEach((sprite) => {
      this.addChild(sprite.sprite);
      this.bounds.addRectangle(sprite.rectangle);
    });
    this.cellsTextHash.updateHashBounds();
  }

  // get sprites
  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      return this.addChild(new TilingSprite(Texture.WHITE));
    } else {
      return this.addChild(new Sprite(Texture.WHITE));
    }
  };
}
