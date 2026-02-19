import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { HtmlCellResizing } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCellResizing';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { Wheel } from '@/app/gridGL/pixiApp/viewport/Wheel';
import type { JsHtmlOutput } from '@/app/quadratic-core-types';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import { Point, Rectangle, type FederatedPointerEvent } from 'pixi.js';

// number of screen pixels to trigger the resize cursor
const tolerance = 5;

// this can be removed since we lock the width and height (I think?)

// this should be kept in sync with run_code/mod.rs and aiToolsSpec.ts
export const DEFAULT_HTML_WIDTH = 600;
const DEFAULT_HTML_HEIGHT = 460;

export const DEFAULT_HTML_CELL_WIDTH = Math.ceil(DEFAULT_HTML_WIDTH / CELL_WIDTH);
export const DEFAULT_HTML_CELL_HEIGHT = Math.ceil(DEFAULT_HTML_HEIGHT / CELL_HEIGHT);

export class HtmlCell {
  private right: HTMLDivElement;
  private bottom: HTMLDivElement;
  private resizing: HtmlCellResizing | undefined;
  private hoverSide: 'right' | 'bottom' | 'corner' | undefined;
  private offset: Rectangle;

  // cache for the thumbnail image
  private thumbnailImage: Promise<string | undefined> | undefined;

  // pre-generated chart image from server (base64 WebP data URL)
  private chartImage: string | undefined;

  // whether the cell is active
  active = false;

  // whether pointer events are allowed on the iframe (currently when selected
  // but not resizing)
  pointerEvents: 'auto' | 'none' = 'none';

  border: HTMLDivElement;

  htmlCell: JsHtmlOutput;

  // bounds for all grid cells that are part of this html cell
  gridBounds: Rectangle;

  sheet: Sheet;

  div: HTMLDivElement;
  iframe: HTMLIFrameElement;

  private autoResizeTimeout: NodeJS.Timeout | undefined;
  private abortController = new AbortController();

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

    this.offset = this.sheet.getScreenRectangle(this.x, this.adjustedY, this.htmlCell.w, this.htmlCell.h - 1);
    this.div.style.left = `${this.offset.x}px`;
    this.div.style.top = `${this.offset.y}px`;

    this.right = document.createElement('div');
    this.right.className = 'html-resize-control-right';
    const topHeight = this.sheet.offsets.getRowHeight(this.y);
    this.right.style.top = `-${topHeight}px`;
    this.right.style.height = `calc(100% + ${topHeight}px)`;

    this.bottom = document.createElement('div');
    this.bottom.className = 'html-resize-control-bottom';

    this.iframe = document.createElement('iframe');
    this.iframe.className = 'html-cell-iframe';
    this.iframe.style.pointerEvents = 'none';
    this.iframe.srcdoc = htmlCell.html;
    this.iframe.width = `${this.width}px`;
    this.iframe.height = `${this.height}px`;
    this.iframe.setAttribute('border', '0');
    this.iframe.setAttribute('scrolling', 'no');
    // Hard-coded for now, since we invert this color
    this.iframe.style.backgroundColor = '#fff';

    this.border = document.createElement('div');
    this.border.className = 'w-full h-full absolute top-0 left-0';
    this.border.style.border = '1px solid hsl(var(--muted-foreground))';

    this.div.append(this.right);
    this.div.append(this.iframe);
    this.div.append(this.bottom);
    this.div.append(this.border);
    this.gridBounds = new Rectangle(this.x, this.y, this.htmlCell.w - 1, this.htmlCell.h - 1);

    // Store pre-generated chart image if available
    this.chartImage = htmlCell.chart_image ?? undefined;

    if (this.iframe.contentWindow?.document.readyState === 'complete') {
      this.afterLoad();
    }
    this.iframe.addEventListener('load', this.afterLoad);

    if (this.sheet.id !== sheets.current) {
      this.div.style.visibility = 'hidden';
    }
  }

  destroy() {
    this.div.remove();
  }

  get x(): number {
    return Number(this.htmlCell.x);
  }
  get adjustedY(): number {
    return Number(this.htmlCell.y) + 1;
  }

  get y(): number {
    return Number(this.htmlCell.y);
  }

  get width(): number {
    return this.offset.width;
  }
  get height(): number {
    return this.offset.height;
  }

  isOutputEqual(htmlCell: JsHtmlOutput): boolean {
    return (
      this.htmlCell.sheet_id === htmlCell.sheet_id && htmlCell.x === this.htmlCell.x && htmlCell.y === this.htmlCell.y
    );
  }

  private afterLoad = () => {
    if (this.iframe.contentWindow) {
      // forward the wheel event to the pixi viewport and adjust its position
      this.iframe.contentWindow.document.removeEventListener('wheel', this.handleWheel);
      this.iframe.contentWindow.document.addEventListener('wheel', this.handleWheel, { passive: false });
      this.iframe.contentWindow.document.body.style = 'margin: 0';
      this.recalculateBounds();
    } else {
      throw new Error('Expected content window to be defined on iframe');
    }
  };

  private handleWheel = (event: WheelEvent) => {
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
  };

  update(htmlCell: JsHtmlOutput) {
    if (!htmlCell.html) throw new Error('Expected html to be defined in HtmlCell.update');

    // If the HTML content has changed, create a new iframe and swap it to avoid flickering
    if (htmlCell.html !== this.htmlCell.html) {
      const newIframe = document.createElement('iframe');
      newIframe.className = 'html-cell-iframe';
      newIframe.style.pointerEvents = 'none';
      newIframe.srcdoc = htmlCell.html;
      newIframe.setAttribute('border', '0');
      newIframe.setAttribute('scrolling', 'no');
      newIframe.style.backgroundColor = '#fff';

      // Hide the new iframe while it loads
      newIframe.style.opacity = '0';
      newIframe.style.position = 'absolute';
      newIframe.style.top = '0';
      newIframe.style.left = '0';

      // Set up the load handler to swap the iframes
      const onLoad = () => {
        // Remove the old iframe and clean up its event listeners
        const oldIframe = this.iframe;
        if (oldIframe.contentWindow?.document) {
          oldIframe.contentWindow.document.removeEventListener('wheel', this.handleWheel);
        }
        oldIframe.removeEventListener('load', this.afterLoad);

        // Make the new iframe visible and reset styles
        newIframe.style.opacity = '1';
        newIframe.style.position = '';
        newIframe.style.top = '';
        newIframe.style.left = '';

        // Remove the old iframe and update reference
        oldIframe.remove();
        this.iframe = newIframe;

        // Set up the new iframe
        this.afterLoad();
      };

      newIframe.addEventListener('load', onLoad, { once: true });

      // Add the new iframe to the DOM so it can load (hidden initially)
      this.div.appendChild(newIframe);
    }

    this.htmlCell = htmlCell;
    this.offset = this.sheet.getScreenRectangle(htmlCell.x, htmlCell.y + 1, htmlCell.w, htmlCell.h - 1);
    this.iframe.width = this.width.toString();
    this.iframe.height = this.height.toString();
    this.border.style.width = `${this.width}px`;
    this.border.style.height = `${this.height}px`;
    this.gridBounds = new Rectangle(this.x, this.y, this.htmlCell.w - 1, this.htmlCell.h - 1);
    this.thumbnailImage = undefined;
    this.chartImage = htmlCell.chart_image ?? undefined;
    this.abortController.abort();
    this.abortController = new AbortController();
  }

  changeSheet(sheetId: string) {
    this.div.style.visibility = sheetId === this.htmlCell.sheet_id ? 'visible' : 'hidden';
  }

  isSheet(sheetId: string) {
    return sheetId === this.htmlCell.sheet_id;
  }

  hover(e: FederatedPointerEvent): 'right' | 'bottom' | 'corner' | 'body' | undefined {
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

  private intersects(e: FederatedPointerEvent): 'right' | 'bottom' | 'corner' | 'body' | undefined {
    const rect = this.div.getBoundingClientRect();
    const { left, top } = pixiApp.canvas.getBoundingClientRect();
    const viewport = pixiApp.viewport;
    const toleranceScaled = tolerance * viewport.scale.x;
    const pointerX = e.global.x + left;
    const pointerY = e.global.y + top;
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

  pointerMove(world: Point) {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.pointerMove');
    }
    this.resizing.pointerMove(world);
  }

  startResizing() {
    if (!this.hoverSide) {
      throw new Error('Expected hoverSide to be defined in HtmlCell.startResizing');
    }
    this.iframe.style.pointerEvents = 'none';
    this.resizing = new HtmlCellResizing(
      this,
      this.hoverSide,
      parseInt(this.iframe.width),
      parseInt(this.iframe.height)
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
    this.iframe.width = width.toString();
    this.border.style.width = `${width}px`;
  }

  setHeight(height: number) {
    this.iframe.height = height.toString();
    this.border.style.height = `${height}px`;
  }

  private recalculateBounds() {
    this.offset = this.sheet.getScreenRectangle(
      this.x,
      this.adjustedY,
      this.htmlCell.w ?? 0,
      (this.htmlCell.h ?? 0) - 1
    );
    this.div.style.left = `${this.offset.x}px`;
    this.div.style.top = `${this.offset.y}px`;
    this.iframe.width = this.width.toString();
    this.iframe.height = this.height.toString();
    this.border.style.width = `${this.width}px`;
    this.border.style.height = `${this.height}px`;

    const topHeight = this.sheet.offsets.getRowHeight(this.y);
    this.right.style.top = `-${topHeight}px`;
    this.right.style.height = `calc(100% + ${topHeight}px)`;

    this.autoResize();
  }

  updateOffsets() {
    this.recalculateBounds();
  }

  // checks if the cell contains a grid point
  contains(x: number, y: number): boolean {
    return intersects.rectanglePoint(this.gridBounds, new Point(x, y));
  }

  activate() {
    this.active = true;
    this.border.style.border = '2px solid hsl(var(--primary))';
    this.pointerEvents = 'auto';
    this.iframe.style.pointerEvents = this.pointerEvents;
  }

  temporarilyDeactivate() {
    this.border.style.border = '1px solid hsl(var(--muted-foreground))';
    this.pointerEvents = 'none';
    this.iframe.style.pointerEvents = this.pointerEvents;
  }

  deactivate() {
    this.active = false;
    this.border.style.border = '1px solid hsl(var(--muted-foreground))';
    this.pointerEvents = 'none';
    this.iframe.style.pointerEvents = this.pointerEvents;
  }

  reactivate() {
    if (this.active) {
      this.activate();
    }
  }

  private autoResize = () => {
    if (this.autoResizeTimeout) {
      clearTimeout(this.autoResizeTimeout);
      this.autoResizeTimeout = undefined;
    }

    if (this.iframe.contentWindow) {
      const plotly = (this.iframe.contentWindow as any).Plotly;
      const plotElement = this.iframe.contentWindow.document.querySelector('.js-plotly-plot');
      if (plotly && plotElement) {
        plotly.relayout(plotElement, {
          width: this.width,
          height: this.height,
        });
      }
    } else {
      this.autoResizeTimeout = setTimeout(this.autoResize, 100);
      this.abortController.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(this.autoResizeTimeout);
          this.autoResizeTimeout = undefined;
        },
        { once: true }
      );
    }
  };

  getImageDataUrl = (): Promise<string | undefined> => {
    // Use pre-generated chart image if available
    if (this.chartImage) {
      return Promise.resolve(this.chartImage);
    }

    if (this.thumbnailImage) {
      return this.thumbnailImage;
    }

    if (this.iframe.contentWindow?.document.readyState === 'complete') {
      this.thumbnailImage = this.getImageDataUrlAfterLoaded(this.abortController);
    } else {
      this.thumbnailImage = new Promise((resolve) => {
        this.iframe.addEventListener(
          'load',
          () => {
            this.getImageDataUrlAfterLoaded(this.abortController)
              .then(resolve)
              .catch((error) => {
                console.error('[HtmlCell.ts] getImageDataUrlAfterLoaded:', error);
                resolve(undefined);
              });
          },
          { once: true, signal: this.abortController.signal }
        );
      });
    }

    return this.thumbnailImage;
  };

  private getImageDataUrlAfterLoaded = (abortController: AbortController): Promise<string | undefined> => {
    return new Promise((resolve) => {
      abortController.signal.addEventListener(
        'abort',
        () => {
          resolve(undefined);
        },
        { once: true }
      );

      const plotly = (this.iframe.contentWindow as any)?.Plotly;
      const plotElement = this.iframe.contentWindow?.document.querySelector('.js-plotly-plot');
      if (!plotly || !plotElement) {
        resolve(undefined);
      } else {
        plotly
          .toImage(plotElement, {
            format: 'png',
            width: this.width,
            height: this.height,
          })
          .then((dataUrl: string) => {
            resolve(dataUrl);
          })
          .catch((error: any) => {
            console.error('[HtmlCell.ts] getImageDataUrlAfterLoaded:', error);
            resolve(undefined);
          });
      }
    });
  };
}
