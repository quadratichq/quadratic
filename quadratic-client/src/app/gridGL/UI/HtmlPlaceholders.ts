import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { colors } from '@/app/theme/colors';
import { Graphics, Sprite, Texture, type Rectangle } from 'pixi.js';

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

    const dataUrl = await htmlCell.getImageDataUrl();
    if (dataUrl) {
      return new Promise((resolve) => {
        const sprite = this.addChild(new Sprite(Texture.EMPTY));
        sprite.texture = Texture.from(dataUrl);

        // Cell area dimensions (adjusted for border)
        const cellAreaWidth = htmlCell.width - BORDER_WIDTH * 2;
        const cellAreaHeight = htmlCell.height - offsets.height;

        // Calculate dimensions that preserve aspect ratio
        const fitToCell = () => {
          const textureWidth = sprite.texture.width;
          const textureHeight = sprite.texture.height;

          if (textureWidth > 0 && textureHeight > 0) {
            const imageAspect = textureWidth / textureHeight;
            const cellAspect = cellAreaWidth / cellAreaHeight;

            let renderWidth: number;
            let renderHeight: number;

            if (imageAspect > cellAspect) {
              // Image is wider than cell area - fit to width
              renderWidth = cellAreaWidth;
              renderHeight = cellAreaWidth / imageAspect;
            } else {
              // Image is taller than cell area - fit to height
              renderWidth = cellAreaHeight * imageAspect;
              renderHeight = cellAreaHeight;
            }

            sprite.width = renderWidth;
            sprite.height = renderHeight;
            // Center the image within the cell area
            sprite.x = offsets.x + 1 + (cellAreaWidth - renderWidth) / 2;
            sprite.y = offsets.y + offsets.height + (cellAreaHeight - renderHeight) / 2;
          } else {
            // Fallback if texture dimensions not available
            sprite.width = cellAreaWidth;
            sprite.height = cellAreaHeight;
            sprite.x = offsets.x + 1;
            sprite.y = offsets.y + offsets.height;
          }
        };

        if (sprite.texture.valid) {
          fitToCell();
          resolve(undefined);
        } else {
          sprite.texture.once('update', () => {
            fitToCell();
            resolve(undefined);
          });
        }
      });
    } else {
      const sprite = this.addChild(new Sprite(Texture.from('chart-placeholder')));
      sprite.width = SPRITE_WIDTH;
      sprite.height = SPRITE_WIDTH;
      sprite.x = offsets.x + (w - SPRITE_WIDTH) / 2;
      sprite.y = offsets.y + (h - SPRITE_WIDTH) / 2;
    }
  };

  prepare = async ({ sheetId, cull }: { sheetId: string; cull: Rectangle }) => {
    this.removeChildren();
    this.clear();

    const drawPlaceholderPromises = htmlCellsHandler.getCells().map((cell) => {
      if (
        cell.sheet.id === sheetId &&
        (!cull || cull.intersects(cell.sheet.getScreenRectangleFromRectangle(cell.gridBounds)))
      ) {
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
