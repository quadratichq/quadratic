import { Graphics } from 'pixi.js';

import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { colors } from '@/app/theme/colors';

const BORDER_WIDTH = 1;

// Draws the html placeholder for thumbnails
export class HtmlPlaceholders extends Graphics {
  constructor() {
    super();
    this.visible = false;
  }

  private drawPlaceholder(htmlCell: HtmlCell) {
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
  }

  prepare() {
    this.clear();
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
