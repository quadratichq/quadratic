import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { InteractionEvent } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';
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
    this.state = state;

    this.startX = offsetX;
    this.startY = offsetY;
    this.originalWidth = this.width = width;
    this.originalHeight = this.height = height;
  }

  pointerMove(e: InteractionEvent) {
    switch (this.state) {
      case 'right':
        this.moveRight(e);
        break;
      case 'bottom':
        this.moveBottom(e);
        break;
      case 'corner':
        this.moveCorner(e);
        break;
    }
  }

  private snapX(e: InteractionEvent): number {
    const xScreen = e.data.global.x;
    // todo: make this work properly
    // if (e.data.originalEvent.shiftKey) return xScreen;
    // for (const line of pixiApp.gridLines.gridLinesX) {
    //   const lineX = pixiApp.viewport.toScreen(line.x, 0).x;
    //   if (Math.abs(lineX - xScreen) <= snapping) {
    //     return lineX;
    //   }
    // }
    return xScreen;
  }

  private snapY(e: InteractionEvent): number {
    const yScreen = e.data.global.y;
    // todo: make this work properly
    // if (e.data.originalEvent.shiftKey) return yScreen;
    // for (const line of pixiApp.gridLines.gridLinesY) {
    //   const lineY = pixiApp.viewport.toScreen(0, line.y).y;
    //   if (Math.abs(lineY - yScreen) <= snapping) {
    //     return lineY;
    //   }
    // }
    return yScreen;
  }

  private moveRight(e: InteractionEvent) {
    this.width = this.originalWidth + (this.snapX(e) - this.startX) / pixiApp.viewport.scale.x;
    this.htmlCell.setWidth(this.width);
  }

  private moveBottom(e: InteractionEvent) {
    this.height = this.originalHeight + (this.snapY(e) - this.startY) / pixiApp.viewport.scale.y;
    this.htmlCell.setHeight(this.height);
  }

  private moveCorner(e: InteractionEvent) {
    this.width = Math.round(this.originalWidth + (this.snapX(e) - this.startX) / pixiApp.viewport.scale.x);
    this.height = Math.round(this.originalHeight + (this.snapY(e) - this.startY) / pixiApp.viewport.scale.y);
    this.htmlCell.setWidth(this.width);
    this.htmlCell.setHeight(this.height);
  }

  completeResizing() {
    grid.setCellRenderSize(sheets.sheet.id, this.htmlCell.x, this.htmlCell.y, this.width, this.height);
  }

  cancelResizing() {
    this.htmlCell.setWidth(this.originalWidth);
    this.htmlCell.setHeight(this.originalHeight);
  }
}
