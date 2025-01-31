import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { HtmlCellResizing } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCellResizing';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { Wheel } from '@/app/gridGL/pixiApp/viewport/Wheel';
import type { JsHtmlOutput } from '@/app/quadratic-core-types';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import type { InteractionEvent } from 'pixi.js';
import { Point, Rectangle } from 'pixi.js';

// number of screen pixels to trigger the resize cursor
const tolerance = 5;

// this should be kept in sync with run_code/mod.rs
export const DEFAULT_HTML_WIDTH = 600;
const DEFAULT_HTML_HEIGHT = 460;

export class HtmlCell {
  private right: HTMLDivElement;
  private bottom: HTMLDivElement;
  private resizing: HtmlCellResizing | undefined;
  private hoverSide: 'right' | 'bottom' | 'corner' | undefined;
  private offset: Point;

  // used during resizing to store the temporary width and height
  private temporaryWidth: number | undefined;
  private temporaryHeight: number | undefined;

  // whether pointer events are allowed on the iframe (currently when selected
  // but not resizing)
  pointerEvents: 'auto' | 'none' = 'none';

  border: HTMLDivElement;

  htmlCell: JsHtmlOutput;
  gridBounds: Rectangle;

  sheet: Sheet;

  div: HTMLDivElement;
  iframe: HTMLIFrameElement;

  constructor(htmlCell: JsHtmlOutput) {
    if (htmlCell.html === null) throw new Error('Expected html to be defined in HtmlCell constructor');
    this.htmlCell = htmlCell;
    const sheet = sheets.getById(htmlCell.sheet_id)!;
    if (!sheet) {
      throw new Error(`Expected to find sheet with id ${htmlCell.sheet_id}`);
    }
    this.sheet = sheet;

    this.div = document.createElement('div');
    this.div.className = 'html-cell';

    const offset = this.sheet.getCellOffsets(Number(htmlCell.x), Number(this.adjustedY));
    this.offset = new Point(offset.x, offset.y);
    this.gridBounds = new Rectangle(Number(htmlCell.x), Number(this.adjustedY), 0, 0);

    this.div.style.left = `${offset.x}px`;
    this.div.style.top = `${offset.y}px`;

    this.right = document.createElement('div');
    this.right.className = 'html-resize-control-right';
    this.bottom = document.createElement('div');
    this.bottom.className = 'html-resize-control-bottom';

    this.iframe = document.createElement('iframe');
    this.iframe.className = 'html-cell-iframe';
    this.iframe.style.pointerEvents = 'none';
    this.iframe.srcdoc = htmlCell.html;
    this.iframe.title = `HTML from ${htmlCell.x}, ${htmlCell.y}}`;
    this.iframe.width = `${this.width}px`;
    this.iframe.height = `${this.height}px`;
    this.iframe.setAttribute('border', '0');
    this.iframe.setAttribute('scrolling', 'no');
    this.iframe.style.minWidth = `${CELL_WIDTH}px`;
    this.iframe.style.minHeight = `${CELL_HEIGHT}px`;
    this.border = document.createElement('div');
    this.border.className = 'w-full h-full absolute top-0 left-0';
    this.border.style.border = '1px solid hsl(var(--primary))';

    this.div.append(this.right);
    this.div.append(this.iframe);
    this.div.append(this.bottom);
    this.div.append(this.border);

    if (this.iframe.contentWindow?.document.readyState === 'complete') {
      this.afterLoad();
    } else {
      this.iframe.addEventListener('load', this.afterLoad);
    }

    this.sheet.gridOverflowLines.updateImageHtml(this.x, this.adjustedY, this.width, this.height);

    if (this.sheet.id !== sheets.current) {
      this.div.style.visibility = 'hidden';
    }
  }

  destroy() {
    this.div.remove();
    this.sheet.gridOverflowLines.updateImageHtml(this.x, this.adjustedY);
  }

  get x(): number {
    return Number(this.htmlCell.x);
  }
  get adjustedY(): number {
    return Number(this.htmlCell.y) + (this.htmlCell.show_name ? 1 : 0);
  }

  get y(): number {
    return Number(this.htmlCell.y);
  }

  get width(): number {
    return this.htmlCell.w ?? DEFAULT_HTML_WIDTH;
  }
  private get height(): number {
    return this.htmlCell.h ?? DEFAULT_HTML_HEIGHT;
  }

  isOutputEqual(htmlCell: JsHtmlOutput): boolean {
    return (
      this.htmlCell.sheet_id === htmlCell.sheet_id && htmlCell.x === this.htmlCell.x && htmlCell.y === this.htmlCell.y
    );
  }

  private afterLoad = () => {
    if (this.iframe.contentWindow) {
      // turn off zooming within the iframe

      // forward the wheel event to the pixi viewport and adjust its position
      this.iframe.contentWindow.document.addEventListener(
        'wheel',
        (event) => {
          event.stopPropagation();
          event.preventDefault();
          const viewport = pixiApp.viewport;
          const wheel = viewport.plugins.get('wheel') as Wheel | null;
          if (!wheel) {
            throw new Error('Expected wheel plugin to be defined on viewport');
          }
          const bounding = this.div.getBoundingClientRect();
          wheel.wheel(event, {
            x: bounding.left + event.clientX * viewport.scale.x - event.clientX,
            y: bounding.top + event.clientY * viewport.scale.y - event.clientY,
          });
        },
        { passive: false }
      );
      this.iframe.contentWindow.document.body.style.margin = '';
      this.calculateGridBounds();
    } else {
      throw new Error('Expected content window to be defined on iframe');
    }
  };

  update(htmlCell: JsHtmlOutput) {
    if (!htmlCell.html) throw new Error('Expected html to be defined in HtmlCell.update');
    if (htmlCell.html !== this.htmlCell.html) {
      this.iframe.srcdoc = htmlCell.html;
    }
    this.htmlCell = htmlCell;
    this.iframe.width = this.width.toString();
    this.iframe.height = this.height.toString();
    this.border.style.width = `${this.width}px`;
    this.border.style.height = `${this.height}px`;
    this.calculateGridBounds();
    this.sheet.gridOverflowLines.updateImageHtml(this.x, this.adjustedY, this.width, this.height);
    this.temporaryWidth = undefined;
    this.temporaryHeight = undefined;
  }

  private calculateGridBounds() {
    const right = this.sheet.offsets.getXPlacement(this.offset.x + this.div.offsetWidth);
    this.gridBounds.width = right.index - this.gridBounds.x;
    const bottom = this.sheet.offsets.getYPlacement(this.offset.y + this.div.offsetHeight);
    this.gridBounds.height = bottom.index - this.gridBounds.y;
  }

  changeSheet(sheetId: string) {
    this.div.style.visibility = sheetId === this.htmlCell.sheet_id ? 'visible' : 'hidden';
  }

  isSheet(sheetId: string) {
    return sheetId === this.htmlCell.sheet_id;
  }

  hover(e: InteractionEvent): 'right' | 'bottom' | 'corner' | 'body' | undefined {
    const target = this.intersects(e);
    if (target === 'right' || target === 'bottom' || target === 'corner') {
      this.hoverSide = target;
      this.highlightEdge();
    } else if (this.hoverSide) {
      this.hoverSide = undefined;
      this.clearHighlightEdges();
    }
    return target;
  }

  private intersects(e: InteractionEvent): 'right' | 'bottom' | 'corner' | 'body' | undefined {
    const rect = this.div.getBoundingClientRect();
    const { left, top } = pixiApp.canvas.getBoundingClientRect();
    const viewport = pixiApp.viewport;
    const toleranceScaled = tolerance * viewport.scale.x;
    const pointerX = e.data.global.x + left;
    const pointerY = e.data.global.y + top;
    const right = pointerX - rect.right < toleranceScaled && pointerX - rect.right > 0;
    const bottom = Math.abs(pointerY - rect.bottom) < toleranceScaled;
    if (right && bottom) {
      return 'corner';
    }
    if (right && pointerY > rect.top && pointerY < rect.bottom) {
      return 'right';
    }
    if (bottom && pointerX > rect.left && pointerX < rect.right) {
      return 'bottom';
    }
    if (pointerX > rect.left && pointerX < rect.right && pointerY > rect.top && pointerY < rect.bottom) {
      return 'body';
    }
  }

  clearHighlightEdges() {
    this.right.style.backgroundColor = '';
    this.bottom.style.backgroundColor = '';
    this.right.classList.remove('html-resize-control-right-corner');
    this.bottom.classList.remove('html-resize-control-bottom-corner');
  }

  highlightEdge() {
    const side = this.hoverSide;

    if (side === 'right' || side === 'corner') {
      this.right.style.backgroundColor = 'hsl(var(--primary))';
    }
    if (side === 'bottom' || side === 'corner') {
      this.bottom.style.backgroundColor = 'hsl(var(--primary))';
    }

    if (side === 'corner') {
      this.right.classList.add('html-resize-control-right-corner');
      this.bottom.classList.add('html-resize-control-bottom-corner');
    }
  }

  pointerMove(e: InteractionEvent) {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.pointerMove');
    }
    this.resizing.pointerMove(e);
  }

  startResizing(x: number, y: number) {
    if (!this.hoverSide) {
      throw new Error('Expected hoverSide to be defined in HtmlCell.startResizing');
    }
    this.iframe.style.pointerEvents = 'none';
    this.resizing = new HtmlCellResizing(
      this,
      this.hoverSide,
      parseInt(this.iframe.width),
      parseInt(this.iframe.height),
      x,
      y
    );
  }

  cancelResizing() {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.endResizing');
    }
    this.right.classList.remove('html-resize-control-right-corner');
    this.bottom.classList.remove('html-resize-control-bottom-corner');
    this.resizing.cancelResizing();
    this.resizing = undefined;
    this.iframe.style.pointerEvents = this.pointerEvents;
  }

  completeResizing() {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.endResizing');
    }
    this.resizing.completeResizing();
    this.resizing = undefined;
    this.iframe.style.pointerEvents = this.pointerEvents;
  }

  setWidth(width: number) {
    this.temporaryWidth = width;
    this.iframe.width = width.toString();
    this.border.style.width = `${width}px`;
    this.sheet.gridOverflowLines.updateImageHtml(this.x, this.adjustedY, width, this.temporaryHeight ?? this.height);
  }

  setHeight(height: number) {
    this.temporaryHeight = height;
    this.iframe.height = height.toString();
    this.border.style.height = `${height}px`;
    this.sheet.gridOverflowLines.updateImageHtml(this.x, this.adjustedY, this.temporaryWidth ?? this.width, height);
  }

  updateOffsets() {
    const offset = this.sheet.getCellOffsets(this.x, this.adjustedY);
    this.offset.set(offset.x, offset.y);
    this.div.style.left = `${offset.x}px`;
    this.div.style.top = `${offset.y}px`;
    this.gridBounds.x = offset.x;
    this.gridBounds.y = offset.y;
  }

  // checks if the cell contains a grid point
  contains(x: number, y: number): boolean {
    return intersects.rectanglePoint(this.gridBounds, new Point(x, y));
  }
}
