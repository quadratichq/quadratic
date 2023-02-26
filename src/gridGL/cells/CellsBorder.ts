export {};
/*
import { Container, Sprite, TilingSprite } from 'pixi.js';
import { QuadrantsSort } from './QuadrantsSort';
import { Coordinate } from '../types/size';
import { drawBorder } from './drawBorder';

interface CellBorder {
  location: Coordinate;
  sprite?: Sprite;
  tilingSprite?: TilingSprite;
}

export class CellsBorder extends Container {
  private borders = new Map<string, CellBorder>();
  private quadrants = new QuadrantsSort<CellBorder>();
  private spritesCache: Sprite[] = [];
  private tilingSpritesCache: TilingSprite[] = [];

  clear(): void {
    this.children.forEach((child) => (child.visible = false));
  }

  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      if (this.tilingIndex < this.tilingSprites.children.length) {
        const tilingSprite = this.tilingSprites.children[this.tilingIndex] as TilingSprite;
        tilingSprite.visible = true;
        tilingSprite.uvRespectAnchor = true;
        this.tilingIndex++;
        return tilingSprite;
      }
      this.tilingIndex++;
      const tilingSprite = this.tilingSprites.addChild(new TilingSprite(Texture.WHITE));
      return tilingSprite;
    } else {
      if (this.spritesIndex < this.sprites.children.length) {
        const sprite = this.sprites.children[this.spritesIndex] as Sprite;
        sprite.visible = true;
        this.spritesIndex++;
        return sprite;
      }
      this.spritesIndex++;
      const sprite = this.sprites.addChild(new Sprite(Texture.WHITE));
      return sprite;
    }
  };

  draw(options: {
    x: number;
    y: number;
    width: number;
    height: number
  }): void {
    const drawInputBorder = (input: CellsDraw, tint: number, alpha: number): void => {
      drawBorder({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        tint,
        alpha,
        getSprite: this.getSprite,
        top: true,
        bottom: true,
        left: true,
        right: true,
      });
    };

    if (input.cell && this.app.settings.showCellTypeOutlines) {
      // Change outline color based on cell type
      if (input.cell.type === 'TEXT') {
        // drawInputBorder(input, colors.cellColorUserText, 0.75);
      } else if (input.cell.type === 'PYTHON') {
        drawInputBorder(input, colors.cellColorUserPython, 0.75);
      } else if (input.cell.type === 'FORMULA') {
        drawInputBorder(input, colors.cellColorUserFormula, 0.75);
      } else if (input.cell.type === 'COMPUTED') {
        // drawInputBorder(input, colors.independence, 0.75);
      }
    }
  }

  drawBorders(borders: Border[]): Rectangle | undefined {
    if (!borders.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const { gridOffsets } = this.app.sheet;
    borders.forEach((border) => {
      const position = gridOffsets.getCell(border.x, border.y);
      if (border.horizontal || border.vertical) {
        drawCellBorder({
          position,
          border,
          getSprite: this.getSprite,
        });
        if (border.horizontal) {
          minX = Math.min(minX, position.x);
          minY = Math.min(minY, position.y);
          maxX = Math.max(maxX, position.x + position.width);
          maxY = Math.max(maxY, position.y);
        }
        if (border.vertical) {
          minX = Math.min(minX, position.x);
          minY = Math.min(minY, position.y);
          maxX = Math.max(maxX, position.x);
          maxY = Math.max(maxY, position.y + position.height);
        }
      }
    });
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsBorder].Sprite ${this.sprites.children.length} objects | ${
        this.sprites.children.filter((child) => child.visible).length
      } visible`
    );
    console.log(
      `[CellsBorder].TilingSprite ${this.tilingSprites.children.length} objects | ${
        this.tilingSprites.children.filter((child) => child.visible).length
      } visible`
    );
  }
}
*/