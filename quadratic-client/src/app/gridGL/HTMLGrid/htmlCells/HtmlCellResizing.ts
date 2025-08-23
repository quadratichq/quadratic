import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
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

  private endX: number;
  private endY: number;

  constructor(htmlCell: HtmlCell, state: 'right' | 'bottom' | 'corner', width: number, height: number) {
    this.htmlCell = htmlCell;

    this.screenPos = sheets.sheet.getCellOffsets(this.htmlCell.x, this.htmlCell.y);
    this.state = state;

    this.originalWidth = this.width = width;
    this.originalHeight = this.height = height;

    this.endX = htmlCell.htmlCell.x + htmlCell.htmlCell.w;
    this.endY = htmlCell.htmlCell.y + htmlCell.htmlCell.h - 1;
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
    const newWidth = placement.position + placement.size - this.screenPos.left;
    if (newWidth > 0) {
      this.width = placement.position + placement.size - this.screenPos.left;
      this.htmlCell.setWidth(this.width);
      this.endX = placement.index + 1;
    }
  }

  private changeHeight(y: number) {
    const top = sheets.sheet.offsets.getRowHeight(this.htmlCell.y);
    const placement = sheets.sheet.offsets.getYPlacement(y);
    const newHeight = placement.position + placement.size - this.screenPos.top - top;
    if (newHeight > 0) {
      this.height = placement.position + placement.size - this.screenPos.top - top;
      this.htmlCell.setHeight(this.height);
      this.endY = placement.index;
    }
  }

  completeResizing() {
    quadraticCore
      .setChartSize(
        sheets.current,
        this.htmlCell.x,
        this.htmlCell.y,
        this.endX - this.htmlCell.x,
        this.endY - this.htmlCell.y,
        false
      )
      .then((response) => {
        if (!response || !response.result) {
          this.cancelResizing();
        }
        if (response?.error) {
          pixiAppSettings.addGlobalSnackbar?.(response.error, { severity: 'error' });
        }
        if (response?.result) {
          this.htmlCell.updateOffsets();
        }
      });
  }

  cancelResizing() {
    this.htmlCell.setWidth(this.originalWidth);
    this.htmlCell.setHeight(this.originalHeight);
    this.width = this.originalWidth;
    this.height = this.originalHeight;
    this.resizeTable();
  }
}
