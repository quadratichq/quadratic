import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { Border } from '../../../schemas';
import { PixiApp } from '../../pixiApp/PixiApp';
import { CellsDraw } from './Cells';
import { drawBorder, drawCellBorder } from './drawBorder';

export class CellsBorder extends Container {
  private app: PixiApp;
  private spritesIndex = 0;
  private sprites: Container;
  private tilingIndex = 0;
  private tilingSprites: Container;

  constructor(app: PixiApp) {
    super();
    this.app = app;
    this.sprites = this.addChild(new Container());
    this.tilingSprites = this.addChild(new Container());
  }

  clear() {
    this.sprites.children.forEach((child) => (child.visible = false));
    this.spritesIndex = 0;
    this.tilingSprites.children.forEach((child) => (child.visible = false));
    this.tilingIndex = 0;
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

  draw(input: CellsDraw): void {
    const drawInputBorder = (input: CellsDraw, tint: number, alpha: number): void => {
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
    };

    if (input.cell && this.app.settings.showCellTypeOutlines) {
      // Change outline color based on cell type
      if (input.cell.type === 'TEXT') {
        // drawInputBorder(input, colors.cellColorUserText, 0.75);
      } else if (input.cell.type === 'PYTHON') {
        drawInputBorder(input, colors.cellColorUserPython, 0.75);
      } else if (input.cell.type === 'FORMULA') {
        drawInputBorder(input, colors.cellColorUserFormula, 0.75);
      } else if (input.cell.type === 'AI') {
        drawInputBorder(input, colors.cellColorUserAI, 0.75);
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
