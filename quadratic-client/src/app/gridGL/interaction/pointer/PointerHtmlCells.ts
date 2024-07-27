import type { InteractionEvent } from 'pixi.js';

import { hasPermissionToEditFile } from '@/app/actions';
import type { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

export class PointerHtmlCells {
  private resizing: HtmlCell | undefined;
  private hovering: HtmlCell | undefined;

  cursor: string | undefined;

  pointerMove(e: InteractionEvent): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    if (this.resizing) {
      this.resizing.pointerMove(e);
      return true;
    }

    const canvas = pixiApp.canvas.getBoundingClientRect();
    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      const side = cell.hover(e, canvas.top);
      if (side) {
        if (this.hovering && this.hovering !== cell) {
          this.hovering.clearHighlightEdges();
        }
        this.hovering = cell;
        this.cursor = side === 'corner' ? 'nwse-resize' : side === 'right' ? 'col-resize' : 'row-resize';
        return true;
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
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      const side = cell.hover(e, canvas.top);
      if (side) {
        this.resizing = cell;
        this.resizing.startResizing(e.data.global.x, e.data.global.y);
        this.cursor = side === 'corner' ? 'nwse-resize' : side === 'right' ? 'col-resize' : 'row-resize';
        return true;
      }
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.resizing) {
      this.resizing.completeResizing();
      this.resizing = undefined;
      return true;
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
}
