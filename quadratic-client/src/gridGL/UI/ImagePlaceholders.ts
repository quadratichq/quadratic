import { sheets } from '@/grid/controller/Sheets';
import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';
import { ImageCell } from '../HTMLGrid/imageCells/ImageCell';
import { imageCellsHandler } from '../HTMLGrid/imageCells/ImageCellsHandler';

const BORDER_WIDTH = 1;

// Draws the image placeholder for thumbnails
export class ImagePlaceholders extends Graphics {
  constructor() {
    super();
    this.visible = false;
  }

  private drawPlaceholder(imageCell: ImageCell) {
    let w = imageCell.div.offsetWidth;
    let h = imageCell.div.offsetHeight;

    const sheet = sheets.getById(imageCell.sheet.id);
    if (!sheet) {
      throw new Error('Expected sheet to be defined in ImagePlaceholders.drawPlaceholder');
    }
    const offsets = sheet.offsets.getCellOffsets(Number(imageCell.x), Number(imageCell.y));
    this.lineStyle(BORDER_WIDTH, colors.imagePlaceholderThumbnailBorderColor, 1);
    this.beginFill(colors.imagePlaceholderThumbnailColor);
    this.drawRect(offsets.x, offsets.y + offsets.h, w, h);
    this.endFill();
  }

  prepare() {
    this.clear();
    const firstId = sheets.getFirst().id;
    imageCellsHandler.getCells().forEach((cell) => {
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
