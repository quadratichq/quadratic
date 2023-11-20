import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { InteractionEvent } from 'pixi.js';

// number of screen pixels to trigger the resize cursor
const tolerance = 10;

export class PointerHtmlCells {
  private state: 'resizing-right' | 'resizing-bottom' | undefined;
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

  private intersects(e: InteractionEvent, setHtmlCell: boolean): 'right' | 'bottom' | undefined {
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const htmlCells = this.getHtmlCells();
    for (let i = 0; i < htmlCells.length; i++) {
      const htmlCell = htmlCells[i] as HTMLIFrameElement;
      const rect = htmlCell.getBoundingClientRect();

      if (
        e.data.global.y > rect.top &&
        e.data.global.y < rect.bottom &&
        Math.abs(e.data.global.x - rect.right) < tolerance
      ) {
        if (setHtmlCell) {
          this.htmlCell = htmlCell;
        }
        return 'right';
      }

      if (
        e.data.global.x > rect.left &&
        e.data.global.x < rect.right &&
        Math.abs(e.data.global.y - rect.bottom + canvas.top) < tolerance
      ) {
        if (setHtmlCell) {
          this.htmlCell = htmlCell;
        }
        return 'bottom';
      }
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
        default:
          this.cursor = undefined;
          return false;
      }
    }
    if (this.state === 'resizing-right') {
      const htmlCells = this.getHtmlCells();
      for (let i = 0; i < htmlCells.length; i++) {
        const htmlCell = htmlCells[i] as HTMLIFrameElement;
        this.width = (e.data.global.x - htmlCell.getBoundingClientRect().left) / pixiApp.viewport.scale.x;
        htmlCell.width = this.width.toString();
      }
    } else if (this.state === 'resizing-bottom') {
      const canvas = pixiApp.canvas.getBoundingClientRect();
      const htmlCells = this.getHtmlCells();
      for (let i = 0; i < htmlCells.length; i++) {
        const htmlCell = htmlCells[i] as HTMLIFrameElement;
        this.height = (e.data.global.y - htmlCell.getBoundingClientRect().top + canvas.top) / pixiApp.viewport.scale.y;
        htmlCell.height = this.height.toString();
      }
    }
    return true;
  }

  pointerDown(e: InteractionEvent): boolean {
    switch (this.intersects(e, true)) {
      case 'right':
        this.state = 'resizing-right';
        this.width = parseFloat(this.htmlCell!.width);
        this.height = parseFloat(this.htmlCell!.height);
        this.htmlCell!.style.pointerEvents = 'none';
        return true;
      case 'bottom':
        this.state = 'resizing-bottom';
        this.width = parseFloat(this.htmlCell!.width);
        this.height = parseFloat(this.htmlCell!.height);
        this.htmlCell!.style.pointerEvents = 'none';
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
      grid.setCellOutputSize(sheets.sheet.id, parseInt(pos[0]), parseInt(pos[1]), this.width, this.height);
      this.state = undefined;
      this.htmlCell!.style.pointerEvents = 'auto';
      this.htmlCell = undefined;
      return true;
    }
    return false;
  }
}
