import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { InteractionEvent } from 'pixi.js';

// number of screen pixels to trigger the resize cursor
const tolerance = 10;

export class PointerHtmlCells {
  private state: 'resizing-right' | 'resizing-bottom' | 'resizing-corner' | undefined;
  private htmlCell?: HTMLIFrameElement | undefined;
  cursor?: string;
  private width?: number;
  private height?: number;

  private getHtmlCells(): HTMLCollection {
    const htmlCells = document.querySelector('.html-cells');
    if (!htmlCells) {
      throw new Error('Expected html-cells to be defined in the DOM');
    }
    return htmlCells.children;
  }

  private intersects(e: InteractionEvent, setHtmlCell: boolean): 'right' | 'bottom' | 'corner' | undefined {
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const htmlCells = this.getHtmlCells();
    for (let i = 0; i < htmlCells.length; i++) {
      const htmlCell = htmlCells[i] as HTMLIFrameElement;
      const rect = htmlCell.getBoundingClientRect();

      const right = Math.abs(e.data.global.x - rect.right) < tolerance;
      const bottom = Math.abs(e.data.global.y - rect.bottom + canvas.top) < tolerance;

      if (right && bottom) {
        if (setHtmlCell) {
          this.htmlCell = htmlCell;
        }
        return 'corner';
      }

      if (e.data.global.y > rect.top && e.data.global.y < rect.bottom && right) {
        if (setHtmlCell) {
          this.htmlCell = htmlCell;
        }
        return 'right';
      }

      if (e.data.global.x > rect.left && e.data.global.x < rect.right && bottom) {
        if (setHtmlCell) {
          this.htmlCell = htmlCell;
        }
        return 'bottom';
      }
    }
  }

  private setWidth(width: number): void {
    this.width = width;
    if (!this.htmlCell) {
      throw new Error('Expected htmlCell to be defined in PointerHtmlCells.setWidth');
    }
    if (this.width === undefined) {
      throw new Error('Expected width to be defined in PointerHtmlCells.setWidth');
    }
    if (this.htmlCell.tagName === 'iframe') {
      this.htmlCell.width = this.width.toString();
    } else {
      this.htmlCell.style.width = `${this.width}px`;
    }
  }

  private setHeight(height: number): void {
    this.height = height;
    if (!this.htmlCell) {
      throw new Error('Expected htmlCell to be defined in PointerHtmlCells.setHeight');
    }
    if (this.height === undefined) {
      throw new Error('Expected height to be defined in PointerHtmlCells.setHeight');
    }
    if (this.htmlCell.tagName === 'iframe') {
      this.htmlCell.height = this.height.toString();
    } else {
      this.htmlCell.style.height = `${this.height}px`;
    }
  }

  pointerMove(e: InteractionEvent): boolean {
    if (!this.state) {
      switch (this.intersects(e, false)) {
        case 'right':
          this.cursor = 'col-resize';
          return true;
        case 'bottom':
          this.cursor = 'row-resize';
          return true;
        case 'corner':
          this.cursor = 'nwse-resize';
          return true;
        default:
          this.cursor = undefined;
          return false;
      }
    }
    const htmlCell = this.htmlCell;
    if (!htmlCell) {
      throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerMove');
    }
    const boundingClientRect = htmlCell.getBoundingClientRect();
    if (this.state === 'resizing-right') {
      this.setWidth((e.data.global.x - boundingClientRect.left) / pixiApp.viewport.scale.x);
    } else if (this.state === 'resizing-bottom') {
      const canvas = pixiApp.canvas.getBoundingClientRect();
      this.setHeight((e.data.global.y - boundingClientRect.top + canvas.top) / pixiApp.viewport.scale.y);
    } else if (this.state === 'resizing-corner') {
      const canvas = pixiApp.canvas.getBoundingClientRect();
      this.setWidth((e.data.global.x - boundingClientRect.left) / pixiApp.viewport.scale.x);
      this.setHeight((e.data.global.y - boundingClientRect.top + canvas.top) / pixiApp.viewport.scale.y);
    }
    return true;
  }

  private startResizing() {
    if (!this.htmlCell) {
      throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerDown');
    }
    if (this.htmlCell.tagName === 'iframe') {
      this.width = parseFloat(this.htmlCell.width);
      this.height = parseFloat(this.htmlCell.height);
    } else {
      this.width = this.htmlCell.offsetWidth;
      this.height = this.htmlCell.offsetHeight;
    }
    this.htmlCell!.style.pointerEvents = 'none';
  }

  pointerDown(e: InteractionEvent): boolean {
    switch (this.intersects(e, true)) {
      case 'right':
        this.state = 'resizing-right';
        this.startResizing();
        return true;
      case 'bottom':
        if (!this.htmlCell) {
          throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerDown');
        }
        this.state = 'resizing-bottom';
        this.startResizing();
        return true;
      case 'corner':
        this.state = 'resizing-corner';
        this.startResizing();
        return true;
      default:
        return false;
    }
  }

  pointerUp(): boolean {
    if (this.state) {
      if (!this.htmlCell) {
        throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerUp');
      }
      const pos = this.htmlCell.getAttribute('data-pos')?.split(',');
      if (!pos) {
        throw new Error('Expected pos to be defined in PointerHtmlCells.pointerUp');
      }
      if (this.width === undefined || this.height === undefined) {
        throw new Error('Expected width and height to be defined in PointerHtmlCells.pointerUp');
      }
      grid.setCellRenderSize(sheets.sheet.id, parseInt(pos[0]), parseInt(pos[1]), this.width, this.height);
      this.state = undefined;
      this.htmlCell!.style.pointerEvents = 'auto';
      this.htmlCell = undefined;
      return true;
    }
    return false;
  }
}
