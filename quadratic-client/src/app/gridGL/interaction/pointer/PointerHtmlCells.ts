import { hasPermissionToEditFile } from '@/app/actions';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { sheets } from '@/app/grid/controller/Sheets.js';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils.js';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { InteractionEvent, Point } from 'pixi.js';

export class PointerHtmlCells {
  private resizing: HtmlCell | undefined; // cell that is being resized
  private hovering: HtmlCell | undefined; // cell whose edge is hovered for resize
  private active: HtmlCell | undefined; // cell that is selected with pointer down
  private clicked: HtmlCell | undefined; // cell that is clicked
  private doubleClickTimeout?: number;

  cursor: string | undefined;

  pointerMove(e: InteractionEvent, world: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    if (this.resizing) {
      this.resizing.pointerMove(world);
      return true;
    }

    this.clicked = undefined;

    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      if (cell.sheet !== sheets.sheet) continue;

      const target = cell.hover(e);
      // pointer hover over chart edge
      if (target === 'right' || target === 'bottom' || target === 'corner') {
        if (this.hovering && this.hovering !== cell) {
          this.hovering.clearHighlightEdges();
        }
        this.hovering = cell;
        this.cursor = target === 'corner' ? 'all-scroll' : target === 'right' ? 'col-resize' : 'row-resize';
        return true;
      }

      // pointer hover over chart
      if (target === 'body') {
        if (this.hovering) {
          this.hovering.clearHighlightEdges();
          this.hovering = undefined;
        }
        this.cursor = undefined;
        return false;
      }
    }
    this.cursor = undefined;
    if (this.hovering) {
      this.hovering.clearHighlightEdges();
      this.hovering = undefined;
    }
    return false;
  }

  pointerDown(e: InteractionEvent): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    const event = e.data.originalEvent as PointerEvent;
    if (event.button !== 0) return false;

    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      if (cell.sheet !== sheets.sheet) continue;
      const target = cell.hover(e);

      // pointer down on chart edge, start resizing
      if (target === 'right' || target === 'bottom' || target === 'corner') {
        this.resizing = cell;
        this.resizing.startResizing();
        this.cursor = target === 'corner' ? 'nwse-resize' : target === 'right' ? 'col-resize' : 'row-resize';
        htmlCellsHandler.movetoTop(cell);
        return true;
      }

      // pointer down on chart
      // select code cell, move chart to top and start double click timer
      if (target === 'body') {
        const cursor = sheets.sheet.cursor;

        // double click
        if (this.clicked === cell) {
          this.clicked = undefined;
          this.clearDoubleClick();
          openCodeEditor();
        }
        // click with meta / ctrl key
        // select cell and add to selection
        else if (event.metaKey || event.ctrlKey) {
          cursor.selectTable(cell.htmlCell.name, undefined, false, true);
        }
        // click without meta / ctrl key
        // select cell and clear selection
        else {
          this.active = cell;
          cursor.selectTable(cell.htmlCell.name, undefined, false, false);
        }
        // move chart to top, useful in case of overlapping charts
        htmlCellsHandler.movetoTop(cell);
        return true;
      }
    }
    return false;
  }

  pointerUp(e: InteractionEvent): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    const active = this.active;
    this.active = undefined;

    if (this.resizing) {
      this.resizing.completeResizing();
      this.resizing = undefined;
      return true;
    }

    // add double click timer
    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      if (cell.sheet !== sheets.sheet) continue;

      const target = cell.hover(e);
      if (target === 'body' && cell === active) {
        this.setDoubleClick();
        this.clicked = cell;
        return true;
      }
      if (target) return false;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.resizing) {
      this.resizing.cancelResizing();
      this.resizing = undefined;
    }
    return false;
  }

  private setDoubleClick(): void {
    this.clearDoubleClick();
    this.doubleClickTimeout = window.setTimeout(() => {
      this.doubleClickTimeout = undefined;
      this.clicked = undefined;
    }, DOUBLE_CLICK_TIME);
  }

  private clearDoubleClick(): void {
    window.clearTimeout(this.doubleClickTimeout);
    this.doubleClickTimeout = undefined;
  }

  destroy(): void {
    this.clearDoubleClick();
  }
}
