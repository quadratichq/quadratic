import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { colors } from '@/app/theme/colors';
import { Graphics, Sprite, Texture } from 'pixi.js';

const BORDER_WIDTH = 1;
const SPRITE_WIDTH = 100;

// Draws the html placeholder for thumbnails
export class HtmlPlaceholders extends Graphics {
  constructor() {
    super();
    this.visible = false;
  }

  private drawPlaceholder = async (htmlCell: HtmlCell) => {
    let w = htmlCell.div.offsetWidth;
    let h = htmlCell.div.offsetHeight;

    const sheet = sheets.getById(htmlCell.sheet.id);
    if (!sheet) {
      throw new Error('Expected sheet to be defined in HtmlPlaceholders.drawPlaceholder');
    }

    const offsets = sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));
    this.lineStyle(BORDER_WIDTH, colors.htmlPlaceholderThumbnailBorderColor, 1);
    this.beginFill(colors.htmlPlaceholderThumbnailColor);
    this.drawRect(offsets.x, offsets.y + offsets.height, w, h);
    this.endFill();

    await new Promise<void>(async (resolve) => {
      const dataUrl = await htmlCell.getImageDataUrl();
      if (dataUrl) {
        const sprite = this.addChild(new Sprite(Texture.EMPTY));
        sprite.texture = Texture.from(dataUrl);
        sprite.texture.once('update', () => {
          sprite.width = htmlCell.width;
          sprite.height = htmlCell.height - offsets.height;
          sprite.x = offsets.x;
          sprite.y = offsets.y + offsets.height;
          resolve();
        });
      } else {
        const sprite = this.addChild(new Sprite(Texture.from('chart-placeholder')));
        sprite.width = SPRITE_WIDTH;
        sprite.height = SPRITE_WIDTH;
        sprite.x = offsets.x + (w - SPRITE_WIDTH) / 2;
        sprite.y = offsets.y + (h - SPRITE_WIDTH) / 2;
        resolve();
      }
    });
  };

  prepare = async () => {
    this.removeChildren();
    this.clear();
    const firstId = sheets.getFirst().id;

    const drawPlaceholderPromises = htmlCellsHandler.getCells().map((cell) => {
      if (cell.sheet.id === firstId) {
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
