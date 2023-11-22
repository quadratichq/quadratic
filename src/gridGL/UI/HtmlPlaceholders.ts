import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';

const BORDER_WIDTH = 1;

// Draws the html placeholder for thumbnails
export class HtmlPlaceholders extends Graphics {
  // tracks the same data as HtmlCells (duplicated to more easily get it out of react)
  private htmlOutput: JsHtmlOutput[] = [];

  constructor() {
    super();
    this.visible = false;
  }

  private drawPlaceholder(htmlCell: JsHtmlOutput) {
    let w = Number(htmlCell.w);
    let h = Number(htmlCell.h);

    // if width and height = 0 (ie, not user set), then use the size of the HTML element
    if (!w || !h) {
      const element = document.querySelector(
        `[data-sheet="${htmlCell.sheet_id}"][data-pos="${htmlCell.x},${htmlCell.y}"]`
      );
      if (!element) return;
      if (element.tagName === 'iframe') {
        const iframe = element as HTMLIFrameElement;
        w = parseFloat(iframe.width);
        h = parseFloat(iframe.height);
      } else {
        w = element.clientWidth;
        h = element.clientHeight;
      }
    }
    const sheet = sheets.getById(htmlCell.sheet_id);
    if (!sheet) {
      throw new Error('Expected sheet to be defined in HtmlPlaceholders.drawPlaceholder');
    }
    const offsets = sheet.offsets.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));
    this.lineStyle(BORDER_WIDTH, colors.htmlPlaceholderThumbnailBorderColor, 1);
    this.beginFill(colors.htmlPlaceholderThumbnailColor);
    this.drawRect(offsets.x, offsets.y, w, h);
    this.endFill();
  }

  prepare() {
    this.clear();
    const firstId = sheets.getFirst().id;
    this.htmlOutput.forEach((cell) => {
      if (cell.sheet_id === firstId) {
        this.drawPlaceholder(cell);
      }
    });
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  setHtmlCells(htmlOutput: JsHtmlOutput[]) {
    this.htmlOutput = htmlOutput;
  }
}
