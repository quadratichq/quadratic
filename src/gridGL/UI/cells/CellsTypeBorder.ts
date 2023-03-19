import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../../pixiApp/PixiApp';
import { drawBorder } from './drawBorder';
import { CellLabel } from './CellLabel';
import { LabelData } from './CellsLabels';

export class CellsTypeBorder extends Container {
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

  draw(label: CellLabel, data: LabelData): void {
    let tint: number | undefined, alpha: number | undefined;
    if (data.cell && this.app.settings.showCellTypeOutlines) {
      // Change outline color based on cell type
      if (data.cell.type === 'PYTHON') {
        tint = colors.cellColorUserPython;
        alpha = 0.75;
      } else if (data.cell.type === 'FORMULA') {
        tint = colors.cellColorUserFormula;
        alpha = 0.75;
      } else {
        return;
      }
    } else {
      return;
    }

    drawBorder({
      x: data.x - (label.overflowLeft ?? 0),
      y: data.y,
      width: data.width + (label.overflowRight ?? 0),
      height: data.height,
      tint,
      alpha,
      getSprite: this.getSprite,
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsTypeBorder].Sprite ${this.sprites.children.length} objects | ${
        this.sprites.children.filter((child) => child.visible).length
      } visible`
    );
    console.log(
      `[CellsTypeBorder].TilingSprite ${this.tilingSprites.children.length} objects | ${
        this.tilingSprites.children.filter((child) => child.visible).length
      } visible`
    );
  }
}
