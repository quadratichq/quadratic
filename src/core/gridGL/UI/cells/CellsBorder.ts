import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { convertColorStringToTint } from '../../../../helpers/convertColor';
import { colors } from '../../../../theme/colors';
import { borderBottom, borderLeft, borderRight, borderTop } from '../../../gridDB/db';
import { PixiApp } from '../../pixiApp/PixiApp';
import { ICellsDraw } from './Cells';
import { drawBorder } from './drawBorder';

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
    this.sprites.children.forEach(child => child.visible = false);
    this.spritesIndex = 0;
    this.tilingSprites.children.forEach(child => child.visible = false);
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
      return this.tilingSprites.addChild(new TilingSprite(Texture.WHITE));
    } else {
      if (this.spritesIndex < this.sprites.children.length) {
        const sprite = this.sprites.children[this.spritesIndex] as Sprite;
        sprite.visible = true;
        this.spritesIndex++;
        return sprite;
      }
      this.spritesIndex++;
      return this.sprites.addChild(new Sprite(Texture.WHITE));
    }
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
        borderType: input.format?.borderType,
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
        borderType: input.format?.borderType,
      });
    }
  }

  debugShowCachedCounts(): void {
    console.log(`[CellsBorder].Sprite ${this.sprites.children.length} objects | ${this.sprites.children.filter(child => child.visible).length} visible`);
    console.log(`[CellsBorder].TilingSprite ${this.tilingSprites.children.length} objects | ${this.tilingSprites.children.filter(child => child.visible).length} visible`);
  }
}