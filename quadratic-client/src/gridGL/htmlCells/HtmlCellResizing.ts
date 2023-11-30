import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { InteractionEvent } from 'pixi.js';
import { HtmlCell } from './HtmlCell';

// tolerance of snapping to the grid
// const snapping = 10;

export class HtmlCellResizing {
  private htmlCell: HtmlCell;
  private state: 'right' | 'bottom' | 'corner';

  private width: number;
  private height: number;

  // used for escaping the resize
  private originalWidth: number;
  private originalHeight: number;

  // adjustment for padding
  private adjustmentX: number;
  private adjustmentY: number;

  constructor(
    htmlCell: HtmlCell,
    state: 'right' | 'bottom' | 'corner',
    width: number,
    height: number,
    style: CSSStyleDeclaration
  ) {
    this.htmlCell = htmlCell;
    this.state = state;

    this.originalWidth = this.width = width;
    this.originalHeight = this.height = height;
    this.adjustmentX = parseInt(style.paddingLeft) + parseInt(style.paddingRight);
    this.adjustmentY = parseInt(style.paddingTop) + parseInt(style.paddingBottom);
  }

  pointerMove(e: InteractionEvent) {}

  completeResizing() {
    grid.setCellRenderSize(
      sheets.sheet.id,
      this.htmlCell.x,
      this.htmlCell.y,
      this.width, //- (this.htmlCellAdjustment?.x ?? 0),
      this.height // - (this.htmlCellAdjustment?.y ?? 0)
    );
  }

  cancelResizing() {
    this.htmlCell.setWidth(this.originalWidth);
    this.htmlCell.setHeight(this.originalHeight);
  }
}
