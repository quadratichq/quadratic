import { HtmlCell } from '@/gridGL/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/gridGL/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { InteractionEvent } from 'pixi.js';

export class PointerHtmlCells {
  private resizing: HtmlCell | undefined;
  // private hovering: HtmlCell | undefined;

  cursor: string | undefined;

  pointerMove(e: InteractionEvent): boolean {
    if (this.resizing) {
      this.resizing.pointerMove(e);
      return true;
    }
    // const canvas = pixiApp.canvas.getBoundingClientRect();
    // const cells = htmlCellsHandler.getCells();
    // for (const cell of cells) {
    //   const side = cell.hover(e, canvas.top);
    //   if (side) {
    //     if (this.hovering) {
    //       this.hovering.clearHighlightEdges();
    //     }
    //     this.hovering = cell;
    //     this.cursor = side === 'corner' ? 'nwse-resize' : side === 'right' ? 'col-resize' : 'row-resize';
    //     return true;
    //   }
    // }
    // this.cursor = undefined;
    return false;
  }

  pointerDown(e: InteractionEvent): boolean {
    const canvas = pixiApp.canvas.getBoundingClientRect();
    const cells = htmlCellsHandler.getCells();
    for (const cell of cells) {
      const side = cell.hover(e, canvas.top);
      if (side) {
        this.resizing = cell;
        this.resizing.startResizing();
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

  // private setWidth(width: number): void {
  //   this.width = width;
  //   if (!this.htmlCell) {
  //     throw new Error('Expected htmlCell to be defined in PointerHtmlCells.setWidth');
  //   }
  //   if (this.width === undefined) {
  //     throw new Error('Expected width to be defined in PointerHtmlCells.setWidth');
  //   }
  //   const isIframe = this.htmlCell.getAttribute('data-type') === 'iframe';
  //   if (isIframe) {
  //     (this.htmlCell.childNodes[1] as HTMLIFrameElement).width = (
  //       this.width - (this.htmlCellAdjustment?.x ?? 0)
  //     ).toString();
  //   } else {
  //     this.htmlCell.style.width = `${this.width}px`;
  //   }
  // }

  // private setHeight(height: number): void {
  //   this.height = height;
  //   if (!this.htmlCell) {
  //     throw new Error('Expected htmlCell to be defined in PointerHtmlCells.setHeight');
  //   }
  //   if (this.height === undefined) {
  //     throw new Error('Expected height to be defined in PointerHtmlCells.setHeight');
  //   }
  //   const isIframe = this.htmlCell.getAttribute('data-type') === 'iframe';
  //   if (isIframe) {
  //     (this.htmlCell.childNodes[1] as HTMLIFrameElement).height = (
  //       this.height - (this.htmlCellAdjustment?.y ?? 0)
  //     ).toString();
  //   } else {
  //     this.htmlCell.style.height = `${this.height}px`;
  //   }
  // }

  // private highlightEdges(htmlCell: HTMLElement | undefined, right: boolean, bottom: boolean) {
  //   if (!htmlCell) return;
  //   const rightDiv = htmlCell.childNodes[0] as HTMLDivElement;
  //   const bottomDiv = htmlCell.childNodes[2] as HTMLDivElement;
  //   if (right) {
  //     rightDiv.classList.add('html-resize-control--is-dragging');
  //   } else {
  //     rightDiv.classList.remove('html-resize-control--is-dragging');
  //   }
  //   if (bottom) {
  //     bottomDiv.classList.add('html-resize-control--is-dragging');
  //   } else {
  //     bottomDiv.classList.remove('html-resize-control--is-dragging');
  //   }
  // }

  // clearHighlightEdges() {
  //   htmlCellsHandler.clearHighlightEdges();
  //   this.htmlCell = undefined;
  //   this.htmlCellHover = undefined;
  // }

  // pointerMove(e: InteractionEvent): boolean {
  //   if (this.htmlCell) {
  //     this.htmlCell.pointerMove(e);
  //     return true;
  //   } else {
  //     switch (this.intersects(e, false)) {
  //       case 'right':
  //         this.cursor = 'col-resize';
  //         this.htmlCellHover!.highlightEdge('right');
  //         return true;
  //       case 'bottom':
  //         this.cursor = 'row-resize';
  //         this.htmlCellHover!.highlightEdge('bottom');
  //         return true;
  //       case 'corner':
  //         this.cursor = 'nwse-resize';
  //         this.htmlCellHover!.highlightEdge('corner');
  //         return true;
  //       default:
  //         this.clearHighlightEdges();
  //         this.cursor = undefined;
  //         return false;
  //     }
  //   }
  //   // const htmlCell = this.htmlCell;
  //   // if (!htmlCell) {
  //   //   throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerMove');
  //   // }
  //   // if (this.state === 'resizing-right') {
  //   //   const x = this.snapX(e);
  //   //   this.htmlCell!.changeWidth(x);
  //   // } else if (this.state === 'resizing-bottom') {
  //   //   const canvas = pixiApp.canvas.getBoundingClientRect();
  //   //   const y = this.snapY(e);
  //   //   this.htmlCell!.changeHeight(y, canvas.top);
  //   // } else if (this.state === 'resizing-corner') {
  //   //   const canvas = pixiApp.canvas.getBoundingClientRect();
  //   //   const x = this.snapX(e);
  //   //   const y = this.snapY(e);
  //   //   this.htmlCell!.changeWidth(x);
  //   //   this.htmlCell!.changeHeight(y, canvas.top);
  //   // }
  //   // return true;
  // }

  // pointerDown(e: InteractionEvent, top: number): 'bottom' | 'right' | 'corner' | undefined {
  //   for (const cell of this.cells) {
  //     const side = cell.intersects(e, top);
  //     if (side) {
  //       this.resizing = cell;
  //       return side;
  //     }
  //   }
  // }

  // pointerDown(e: InteractionEvent): boolean {
  //   switch (this.intersects(e, true)) {
  //     case 'right':
  //       this.state = 'resizing-right';
  //       this.startResizing();
  //       return true;
  //     case 'bottom':
  //       if (!this.htmlCell) {
  //         throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerDown');
  //       }
  //       this.state = 'resizing-bottom';
  //       this.startResizing();
  //       return true;
  //     case 'corner':
  //       this.state = 'resizing-corner';
  //       this.startResizing();
  //       return true;
  //     default:
  //       return false;
  //   }
  // }

  // pointerUp(): boolean {
  //   if (this.state) {
  //     if (!this.htmlCell) {
  //       throw new Error('Expected htmlCell to be defined in PointerHtmlCells.pointerUp');
  //     }
  //     const pos = this.htmlCell.getAttribute('data-pos')?.split(',');
  //     if (!pos) {
  //       throw new Error('Expected pos to be defined in PointerHtmlCells.pointerUp');
  //     }
  //     if (this.width === undefined || this.height === undefined) {
  //       throw new Error('Expected width and height to be defined in PointerHtmlCells.pointerUp');
  //     }
  //     grid.setCellRenderSize(
  //       sheets.sheet.id,
  //       parseInt(pos[0]),
  //       parseInt(pos[1]),
  //       this.width - (this.htmlCellAdjustment?.x ?? 0),
  //       this.height - (this.htmlCellAdjustment?.y ?? 0)
  //     );
  //     console.log(this.width - (this.htmlCellAdjustment?.x ?? 0), this.height - (this.htmlCellAdjustment?.y ?? 0));
  //     this.state = undefined;
  //     this.htmlCell!.style.pointerEvents = 'auto';
  //     this.htmlCell = undefined;
  //     return true;
  //   }
  //   return false;
  // }
}
