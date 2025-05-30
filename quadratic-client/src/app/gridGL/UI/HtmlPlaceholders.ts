import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { colors } from '@/app/theme/colors';
import type { Rectangle } from 'pixi.js';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';

const BORDER_WIDTH = 1;
const SPRITE_WIDTH = 100;

// Draws the html placeholder for thumbnails
export class HtmlPlaceholders extends Container {
  private graphics: Graphics;
  private thumbnails: Container;

  constructor() {
    super();
    this.visible = false;
    this.thumbnails = this.addChild(new Container());
    this.graphics = this.addChild(new Graphics());
  }

  private drawPlaceholder = async (htmlCell: HtmlCell) => {
    let w = htmlCell.div.offsetWidth;
    let h = htmlCell.div.offsetHeight;

    const sheet = sheets.getById(htmlCell.sheet.id);
    if (!sheet) {
      throw new Error('Expected sheet to be defined in HtmlPlaceholders.drawPlaceholder');
    }

    const offsets = sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));
    this.graphics.rect(offsets.x, offsets.y + offsets.height, w, h);
    this.graphics.fill({ color: colors.htmlPlaceholderThumbnailColor });
    this.graphics.stroke({ color: colors.htmlPlaceholderThumbnailBorderColor, width: BORDER_WIDTH });

    const dataUrl = await htmlCell.getImageDataUrl();
    if (dataUrl) {
      return new Promise((resolve) => {
        const sprite = this.addChild(new Sprite(Texture.EMPTY));
        sprite.texture = Texture.from(dataUrl);
        // need to adjust the width to account for the border
        sprite.width = htmlCell.width - 2;
        sprite.height = htmlCell.height - offsets.height;
        sprite.x = offsets.x + 1;
        sprite.y = offsets.y + offsets.height;
        sprite.texture.once('update', () => {
          resolve(undefined);
        });
      });
    } else {
      const sprite = this.addChild(new Sprite(Texture.from('chart-placeholder')));
      sprite.width = SPRITE_WIDTH;
      sprite.height = SPRITE_WIDTH;
      sprite.x = offsets.x + (w - SPRITE_WIDTH) / 2;
      sprite.y = offsets.y + (h - SPRITE_WIDTH) / 2;
    }
  };

  prepare = async (cull?: Rectangle) => {
    this.removeChildren();
    this.graphics.clear();
    const firstId = sheets.getFirst().id;

    const drawPlaceholderPromises = htmlCellsHandler.getCells().map((cell) => {
      if (cell.sheet.id === firstId && (!cull || cull.intersects(cell.gridBounds))) {
        return this.drawPlaceholder(cell);
      } else {
        return Promise.resolve();
      }
    });

    await Promise.all(drawPlaceholderPromises);

    this.visible = true;
  };

  hide() {
    this.visible = false;
  }
}
