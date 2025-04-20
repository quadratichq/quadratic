import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { colors } from '@/app/theme/colors';
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

  private drawPlaceholder(htmlCell: HtmlCell) {
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
    const thumbnail = this.thumbnails.addChild(new Sprite(Texture.from('chart-placeholder')));
    thumbnail.width = SPRITE_WIDTH;
    thumbnail.height = SPRITE_WIDTH;
    thumbnail.x = offsets.x + (w - SPRITE_WIDTH) / 2;
    thumbnail.y = offsets.y + (h - SPRITE_WIDTH) / 2;
  }

  prepare() {
    this.thumbnails.removeChildren();
    this.graphics.clear();
    const firstId = sheets.getFirst().id;
    htmlCellsHandler.getCells().forEach((cell) => {
      if (cell.sheet.id === firstId) {
        this.drawPlaceholder(cell);
      }
    });
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}
