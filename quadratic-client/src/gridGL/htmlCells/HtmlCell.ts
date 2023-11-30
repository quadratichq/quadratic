import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { colors } from '@/theme/colors';
import { InteractionEvent } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';
import { Wheel } from '../pixiOverride/Wheel';
import { HtmlCellResizing } from './HtmlCellResizing';

// number of screen pixels to trigger the resize cursor
const tolerance = 10;

export class HtmlCell {
  private right: HTMLDivElement;
  private iframe: HTMLIFrameElement;
  private bottom: HTMLDivElement;
  private htmlCell: JsHtmlOutput;
  private resizing: HtmlCellResizing | undefined;
  private hoverSide: 'right' | 'bottom' | 'corner' | undefined;

  div: HTMLDivElement;

  constructor(htmlCell: JsHtmlOutput) {
    this.htmlCell = htmlCell;

    this.div = document.createElement('div');
    this.div.className = 'html-cell';
    this.div.style.border = `1px solid ${colors.cellColorUserPythonRgba}`;
    const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));

    // the 0.5 is adjustment for the border
    this.div.style.left = `${offset.x - 0.5}px`;
    this.div.style.top = `${offset.y + offset.height - 0.5}px`;

    this.right = document.createElement('div');
    this.right.className = 'html-resize-control-right';
    this.bottom = document.createElement('div');
    this.bottom.className = 'html-resize-control-bottom';

    this.iframe = document.createElement('iframe');
    this.iframe.srcdoc = htmlCell.html;
    this.iframe.title = `HTML from ${htmlCell.x}, ${htmlCell.y}}`;
    this.iframe.width = htmlCell.w ? htmlCell.w.toString() : '';
    this.iframe.height = htmlCell.h ? htmlCell.h.toString() : '';
    this.iframe.style.minWidth = `${CELL_WIDTH}px`;
    this.iframe.style.minHeight = `${CELL_HEIGHT}px`;

    this.div.appendChild(this.iframe);
    this.div.appendChild(this.right);
    this.div.appendChild(this.bottom);

    if (this.iframe.contentWindow?.document.readyState === 'complete') {
      this.afterLoad();
    } else {
      this.iframe.addEventListener('load', this.afterLoad);
    }
  }

  get x(): number {
    return Number(this.htmlCell.x);
  }
  get y(): number {
    return Number(this.htmlCell.y);
  }

  isOutputEqual(htmlCell: JsHtmlOutput): boolean {
    return (
      this.htmlCell.sheet_id === htmlCell.sheet_id && htmlCell.x === this.htmlCell.x && htmlCell.y === this.htmlCell.y
    );
  }

  private afterLoad = () => {
    if (this.iframe.contentWindow) {
      // turn off zooming within the iframe
      this.iframe.contentWindow.document.body.style.touchAction = 'none pan-x pan-y';

      // forward the wheel event to the pixi viewport and adjust its position
      this.iframe.contentWindow.document.body.addEventListener(
        'wheel',
        (event) => {
          const viewport = pixiApp.viewport;
          const wheel = viewport.plugins.get('wheel') as Wheel | null;
          if (!wheel) {
            throw new Error('Expected wheel plugin to be defined on viewport');
          }
          const bounding = this.iframe.getBoundingClientRect();
          wheel.wheel(event, {
            x: bounding.left + event.clientX * viewport.scale.x - event.clientX,
            y: bounding.top + event.clientY * viewport.scale.y - event.clientY,
          });
          event.stopPropagation();
          event.preventDefault();
        },
        { passive: false }
      );
      const style = window.getComputedStyle(this.iframe.contentWindow.document.body);

      // move margin to the div holding the iframe to avoid pinch-to-zoom issues at the iframe margins
      if (style.marginLeft) {
        this.div.style.paddingLeft = style.marginLeft;
        this.iframe.contentWindow.document.body.style.marginLeft = '0';
      }
      if (style.marginTop) {
        this.div.style.paddingTop = style.marginTop;
        this.iframe.contentWindow.document.body.style.marginTop = '0';
      }
      if (style.marginRight) {
        this.div.style.paddingRight = style.marginRight;
        this.iframe.contentWindow.document.body.style.marginRight = '0';
      }
      if (style.marginBottom) {
        this.div.style.paddingBottom = style.marginBottom;
        this.iframe.contentWindow.document.body.style.marginBottom = '0';
      }

      if (!this.htmlCell.w) {
        this.iframe.width = (
          this.iframe.contentWindow.document.body.scrollWidth +
          parseInt(style.marginLeft) +
          parseInt(style.marginRight)
        ).toString();
      } else {
        this.iframe.width = this.htmlCell.w.toString();
      }
      if (!this.htmlCell.h) {
        this.iframe.height = (
          this.iframe.contentWindow.document.body.scrollHeight +
          parseInt(style.marginTop) +
          parseInt(style.marginBottom)
        ).toString();
      } else {
        this.iframe.height = this.htmlCell.h.toString();
      }
    } else {
      throw new Error('Expected content window to be defined on iframe');
    }
  };

  update(htmlCell: JsHtmlOutput) {
    if (htmlCell.w !== undefined && htmlCell.h !== undefined) {
      this.iframe.width = htmlCell.w.toString();
      this.iframe.height = htmlCell.h.toString();
    }
    this.iframe.srcdoc = htmlCell.html;
  }

  changeSheet(sheetId: string) {
    this.div.style.visibility = sheetId === this.htmlCell.sheet_id ? 'visible' : 'hidden';
  }

  isSheet(sheetId: string) {
    return sheetId === this.htmlCell.sheet_id;
  }

  hover(e: InteractionEvent, top: number): 'right' | 'bottom' | 'corner' | undefined {
    const side = this.intersects(e, top);
    if (side) {
      this.hoverSide = side;
      this.highlightEdge();
      return side;
    }
  }

  intersects(e: InteractionEvent, top: number): 'right' | 'bottom' | 'corner' | undefined {
    const rect = this.div.getBoundingClientRect();
    const right = Math.abs(e.data.global.x - rect.right) < tolerance;
    const bottom = Math.abs(e.data.global.y - rect.bottom + top) < tolerance;
    if (right && bottom) {
      return 'corner';
    }
    if (right && e.data.global.y > rect.top && e.data.global.y < rect.bottom) {
      return 'right';
    }
    if (bottom && e.data.global.x > rect.left && e.data.global.x < rect.right) {
      return 'bottom';
    }
  }

  // private snapX(e: InteractionEvent): number {
  //   const xScreen = e.data.global.x;
  //   if (e.data.originalEvent.shiftKey) return xScreen;
  //   const x = pixiApp.viewport.toWorld(xScreen - (this.htmlCellAdjustment?.x ?? 0), 0).x;
  //   for (const line of pixiApp.gridLines.gridLinesX) {
  //     if (Math.abs(line.x - x) <= snapping) {
  //       return pixiApp.viewport.toScreen(line.x, 0).x;
  //     }
  //   }
  //   return e.data.global.x;
  // }

  // private snapY(e: InteractionEvent): number {
  //   const yScreen = e.data.global.y;
  //   if (e.data.originalEvent.shiftKey) return yScreen;
  //   const y = pixiApp.viewport.toWorld(0, yScreen).y;
  //   for (const line of pixiApp.gridLines.gridLinesY) {
  //     if (Math.abs(line.y - y) <= snapping) {
  //       return pixiApp.viewport.toScreen(0, line.y).y;
  //     }
  //   }
  //   return e.data.global.y;
  // }

  moveRight(e: InteractionEvent) {
    // (x - boundingClientRect.left) / pixiApp.viewport.scale.x)
    // this.iframe.width = width.toString();
  }

  moveBottom(e: InteractionEvent) {
    // this.setHeight((y - boundingClientRect.top + canvas.top) / pixiApp.viewport.scale.y);
    // this.iframe.height = height.toString();
  }

  moveCorner(e: InteractionEvent) {}

  clearHighlightEdges() {
    // this.right.classList.remove('html-resize-control--is-dragging');
    // this.bottom.classList.remove('html-resize-control--is-dragging');
  }

  highlightEdge() {
    // const side = this.hoverSide;
    // if (side === 'right' || side === 'corner') {
    //   this.right.classList.add('html-resize-control--is-dragging');
    // }
    // if (side === 'bottom' || side === 'corner') {
    //   this.bottom.classList.add('html-resize-control--is-dragging');
    // }
  }

  pointerMove(e: InteractionEvent) {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.pointerMove');
    }
    this.resizing.pointerMove(e);
  }

  startResizing() {
    if (!this.hoverSide) {
      throw new Error('Expected hoverSide to be defined in HtmlCell.startResizing');
    }
    this.div.style.pointerEvents = 'none';
    this.resizing = new HtmlCellResizing(
      this,
      this.hoverSide,
      parseInt(this.iframe.width),
      parseInt(this.iframe.height),
      window.getComputedStyle(this.div)
    );
  }

  cancelResizing() {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.endResizing');
    }
    this.resizing.cancelResizing();
    this.div.style.pointerEvents = 'auto';
    this.resizing = undefined;
  }

  completeResizing() {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.endResizing');
    }
    this.resizing.completeResizing();
    this.div.style.pointerEvents = 'auto';
    this.resizing = undefined;
  }

  setWidth(width: number) {
    this.iframe.width = width.toString();
  }

  setHeight(height: number) {
    this.iframe.height = height.toString();
  }
}
