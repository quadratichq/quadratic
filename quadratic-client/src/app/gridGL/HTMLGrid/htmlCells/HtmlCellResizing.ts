import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { Point, Rectangle } from 'pixi.js';

// tolerance of snapping to the grid
// const snapping = 10;

export class HtmlCellResizing {
  private htmlCell: HtmlCell;
  private state: 'right' | 'bottom' | 'corner';

  private screenPos: Rectangle;

  private width: number;
  private height: number;

  // used for escaping the resize
  private originalWidth: number;
  private originalHeight: number;

  // adjustment for pointer down position
  private startX: number;
  private startY: number;

  constructor(
    htmlCell: HtmlCell,
    state: 'right' | 'bottom' | 'corner',
    width: number,
    height: number,
    offsetX: number,
    offsetY: number
  ) {
    this.htmlCell = htmlCell;

    this.screenPos = sheets.sheet.getCellOffsets(this.htmlCell.x, this.htmlCell.y);
    this.state = state;

    this.startX = offsetX;
    this.startY = offsetY;
    this.originalWidth = this.width = width;
    this.originalHeight = this.height = height;
  }

  pointerMove(world: Point) {
    switch (this.state) {
      case 'right':
        this.changeWidth(world.x);
        break;
      case 'bottom':
        this.changeHeight(world.y);
        break;
      case 'corner':
        this.changeWidth(world.x);
        this.changeHeight(world.y);
        break;
    }
    this.resizeTable();
  }

  private resizeTable() {
    pixiApp.cellsSheet().tables.resizeTable(this.htmlCell.x, this.htmlCell.y, this.width, this.height);
  }

  private changeWidth(x: number) {
    const placement = sheets.sheet.offsets.getXPlacement(x);
    this.width = placement.position + placement.size - this.screenPos.left;
    this.htmlCell.setWidth(this.width);
  }

  private changeHeight(y: number) {
    const top = sheets.sheet.offsets.getRowHeight(this.htmlCell.y);
    const placement = sheets.sheet.offsets.getYPlacement(y);
    this.height = placement.position + placement.size - this.screenPos.top - top;
    this.htmlCell.setHeight(this.height);
  }

  completeResizing() {
    const topHeight = sheets.sheet.offsets.getRowHeight(this.htmlCell.y);
    quadraticCore.setCellRenderResize(
      sheets.current,
      this.htmlCell.x,
      this.htmlCell.y,
      this.width - 1,
      this.height - topHeight
    );
  }

  cancelResizing() {
    this.htmlCell.setWidth(this.originalWidth);
    this.htmlCell.setHeight(this.originalHeight);
    this.width = this.originalWidth;
    this.height = this.originalHeight;
    this.resizeTable();
  }
}
