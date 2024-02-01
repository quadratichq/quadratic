import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { sheets } from '@/grid/controller/Sheets';
import { Sheet } from '@/grid/sheet/Sheet';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { colors } from '@/theme/colors';
import { InteractionEvent } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';
import { Wheel } from '../../pixiOverride/Wheel';
import { HtmlCellResizing } from './HtmlCellResizing';

// number of screen pixels to trigger the resize cursor
const tolerance = 5;

const DEFAULT_HTML_WIDTH = '600';
const DEFAULT_HTML_HEIGHT = '460';

const ALLOW_CHART_INTERACTIVITY = import.meta.env.VITE_ALLOW_CHART_INTERACTIVITY === '1';

export class HtmlCell {
  private right: HTMLDivElement;
  private iframe: HTMLIFrameElement;
  private bottom: HTMLDivElement;
  private htmlCell: JsHtmlOutput;
  private resizing: HtmlCellResizing | undefined;
  private hoverSide: 'right' | 'bottom' | 'corner' | undefined;

  sheet: Sheet;

  div: HTMLDivElement;

  constructor(htmlCell: JsHtmlOutput) {
    this.htmlCell = htmlCell;
    const sheet = sheets.getById(htmlCell.sheet_id)!;
    if (!sheet) {
      throw new Error(`Expected to find sheet with id ${htmlCell.sheet_id}`);
    }
    this.sheet = sheet;

    this.div = document.createElement('div');
    this.div.className = 'html-cell';
    this.div.style.border = `1px solid ${colors.cellColorUserPythonRgba}`;
    const offset = this.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));

    // the 0.5 is adjustment for the border
    this.div.style.left = `${offset.x - 0.5}px`;
    this.div.style.top = `${offset.y + offset.height - 0.5}px`;

    this.right = document.createElement('div');
    this.right.className = 'html-resize-control-right';
    this.bottom = document.createElement('div');
    this.bottom.className = 'html-resize-control-bottom';

    this.iframe = document.createElement('iframe');
    this.iframe.className = 'html-cell-iframe';
    this.iframe.style.pointerEvents = ALLOW_CHART_INTERACTIVITY ? 'auto' : 'none';
    this.iframe.srcdoc = htmlCell.html;
    this.iframe.title = `HTML from ${htmlCell.x}, ${htmlCell.y}}`;
    this.iframe.width = this.width;
    this.iframe.height = this.height;
    this.iframe.setAttribute('border', '0');
    this.iframe.setAttribute('scrolling', 'no');
    this.iframe.style.minWidth = `${CELL_WIDTH}px`;
    this.iframe.style.minHeight = `${CELL_HEIGHT}px`;

    this.div.append(this.right);
    this.div.append(this.iframe);
    this.div.append(this.bottom);

    if (this.iframe.contentWindow?.document.readyState === 'complete') {
      this.afterLoad();
    } else {
      this.iframe.addEventListener('load', this.afterLoad);
    }

    if (this.sheet.id !== sheets.sheet.id) {
      this.div.style.visibility = 'hidden';
    }
  }

  get x(): number {
    return Number(this.htmlCell.x);
  }
  get y(): number {
    return Number(this.htmlCell.y);
  }

  private get width(): string {
    return this.htmlCell.w ?? DEFAULT_HTML_WIDTH;
  }
  private get height(): string {
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
      this.iframe.contentWindow.document.body.addEventListener(
        'wheel',
        (event) => {
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
          event.stopPropagation();
          event.preventDefault();
        },
        { passive: false }
      );

      // move margin to the div holding the iframe to avoid pinch-to-zoom issues at the iframe margins
      // const style = window.getComputedStyle(this.iframe.contentWindow.document.body);
      // if (style.marginLeft) {
      //   this.div.style.paddingLeft = style.marginLeft;
      // }
      // if (style.marginTop) {
      //   this.div.style.paddingTop = style.marginTop;
      // }
      // if (style.marginRight) {
      //   this.div.style.paddingRight = style.marginRight;
      // }
      // if (style.marginBottom) {
      //   this.div.style.paddingBottom = style.marginBottom;
      // }

      this.iframe.contentWindow.document.body.style.margin = '';

      // this is the automatic size calculation -- replaced for *now* with default width/height
      // if (!this.htmlCell.w) {
      //   this.iframe.width = (
      //     this.iframe.contentWindow.document.body.scrollWidth +
      //     parseInt(style.marginLeft) +
      //     parseInt(style.marginRight)
      //   ).toString();
      // } else {
      //   this.iframe.width = this.htmlCell.w;
      // }
      // if (!this.htmlCell.h) {
      //   this.iframe.height = (
      //     this.iframe.contentWindow.document.body.scrollHeight +
      //     parseInt(style.marginTop) +
      //     parseInt(style.marginBottom)
      //   ).toString();
      // } else {
      //   this.iframe.height = this.htmlCell.h;
      // }
    } else {
      throw new Error('Expected content window to be defined on iframe');
    }
  };

  update(htmlCell: JsHtmlOutput) {
    if (htmlCell.w !== this.htmlCell.w && htmlCell.h !== this.htmlCell.h) {
      this.iframe.width = htmlCell.w ?? DEFAULT_HTML_WIDTH;
      this.iframe.height = htmlCell.h ?? DEFAULT_HTML_HEIGHT;
    }
    if (htmlCell.html !== this.htmlCell.html) {
      this.iframe.srcdoc = htmlCell.html;
    }
    this.htmlCell = htmlCell;
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
    } else if (this.hoverSide) {
      this.hoverSide = undefined;
      this.clearHighlightEdges();
    }
  }

  intersects(e: InteractionEvent, top: number): 'right' | 'bottom' | 'corner' | undefined {
    const rect = this.div.getBoundingClientRect();
    const viewport = pixiApp.viewport;
    const toleranceScaled = tolerance * viewport.scale.x;
    const right = e.data.global.x - rect.right < toleranceScaled && e.data.global.x - rect.right > 0;
    const bottom = Math.abs(e.data.global.y - rect.bottom + top) < toleranceScaled;
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

  clearHighlightEdges() {
    this.right.style.backgroundColor = '';
    this.bottom.style.backgroundColor = '';
    this.right.classList.remove('html-resize-control-right-corner');
    this.bottom.classList.remove('html-resize-control-bottom-corner');
  }

  highlightEdge() {
    const side = this.hoverSide;

    if (side === 'right' || side === 'corner') {
      this.right.style.backgroundColor = colors.quadraticPrimary;
    }
    if (side === 'bottom' || side === 'corner') {
      this.bottom.style.backgroundColor = colors.quadraticPrimary;
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
  }

  completeResizing() {
    if (!this.resizing) {
      throw new Error('Expected resizing to be defined in HtmlCell.endResizing');
    }
    this.resizing.completeResizing();
    this.resizing = undefined;
  }

  setWidth(width: number) {
    this.iframe.width = width.toString();
  }

  setHeight(height: number) {
    this.iframe.height = height.toString();
  }

  updateOffsets() {
    const offset = this.sheet.getCellOffsets(this.x, this.y);

    // the 0.5 is adjustment for the border
    this.div.style.left = `${offset.x - 0.5}px`;
    this.div.style.top = `${offset.y + offset.height - 0.5}px`;
  }
}
