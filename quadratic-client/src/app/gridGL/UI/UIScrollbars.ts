//! Draws scrollbars for the grid.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Container, Sprite, Texture } from 'pixi.js';

const SCROLLBAR_SIZE = 8;
const SCROLLBAR_PADDING = 8;
const SCROLLBAR_COLOR = 0x000000;
const SCROLLBAR_ALPHA = 0.2;

export class UIScrollbars extends Container {
  private dirty = true;

  private horizontal = new Sprite(Texture.WHITE);
  private vertical = new Sprite(Texture.WHITE);

  private horizontalShow = false;
  private verticalShow = false;

  constructor() {
    super();
    this.horizontal.height = SCROLLBAR_SIZE;
    this.vertical.width = SCROLLBAR_SIZE;
    this.horizontal.alpha = SCROLLBAR_ALPHA;
    this.vertical.alpha = SCROLLBAR_ALPHA;
    this.horizontal.tint = SCROLLBAR_COLOR;
    this.vertical.tint = SCROLLBAR_COLOR;
    this.addChild(this.horizontal);
    this.addChild(this.vertical);
    events.on('viewportChanged', this.setDirty);
    window.addEventListener('resize', this.setDirty);
  }

  destroy() {
    events.off('viewportChanged', this.setDirty);
    window.removeEventListener('resize', this.setDirty);
  }

  private setDirty = () => (this.dirty = true);

  /*
        this.scrollbarTop = (this.content.top / height) * this.boxHeight
        this.scrollbarTop = this.scrollbarTop < 0 ? 0 : this.scrollbarTop
        this.scrollbarHeight = (this.boxHeight / height) * this.boxHeight
        this.scrollbarHeight = this.scrollbarTop + this.scrollbarHeight > this.boxHeight ? this.boxHeight - this.scrollbarTop : this.scrollbarHeight
        this.scrollbarLeft = (this.content.left / width) * this.boxWidth
        this.scrollbarLeft = this.scrollbarLeft < 0 ? 0 : this.scrollbarLeft
        this.scrollbarWidth = (this.boxWidth / width) * this.boxWidth
*/

  /**
   * Calculates the start and size of the scrollbar. All parameters are in
   * viewport coordinates.
   *
   * @param contentSize - total size of the content
   * @param viewportStart - visible start of the viewport
   * @param viewportEnd - visible end of the viewport
   *
   * @returns the start and size of the scrollbar in percentages or undefined if
   * the scrollbar is not visible--ie, the content is visible and smaller than
   * the viewport
   */
  private calculateSize(
    contentSize: number,
    viewportStart: number,
    viewportEnd: number
  ): { start: number; size: number } | undefined {
    const viewportTotal = viewportEnd - viewportStart;

    // If the content is smaller than the viewport, and the viewport is at the
    // start of the content, then the scrollbar is not visible.
    if (contentSize <= viewportTotal && viewportStart === 0) {
      return undefined;
    }

    // we use the largest of the content size or the viewport size to calculate
    // the scrollbar size
    const adjustedContentSize = Math.max(contentSize, viewportTotal);
    const start = viewportStart / adjustedContentSize;
    const size = viewportTotal / adjustedContentSize;
    return { start, size };
  }

  // Calculates the scrollbar positions and sizes
  private calculate() {
    const viewport = pixiApp.viewport;
    const { screenWidth, screenHeight } = viewport;
    const { headingSize } = pixiApp.headings;
    const viewportBounds = viewport.getVisibleBounds();
    const contentBounds = sheets.sheet.getScrollbarBounds();
    if (!contentBounds) return;

    const horizontal = this.calculateSize(contentBounds.width, viewportBounds.left, viewportBounds.right);
    if (horizontal) {
      const start = headingSize.width;
      const actualWidth = screenWidth - start - SCROLLBAR_PADDING;
      this.horizontal.visible = true;
      this.horizontal.x = Math.max(start, start + horizontal.start * actualWidth);
      const rightClamp = screenWidth - start - SCROLLBAR_PADDING * 2 - this.horizontal.x;
      this.horizontal.width = Math.min(rightClamp, horizontal.size * actualWidth);
      this.horizontal.y = screenHeight - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
    } else {
      this.horizontal.visible = false;
    }

    const vertical = this.calculateSize(contentBounds.height, viewportBounds.top, viewportBounds.bottom);
    if (vertical) {
      const start = headingSize.height + SCROLLBAR_PADDING;
      const actualHeight = screenHeight - start - SCROLLBAR_PADDING * 2;
      this.vertical.visible = true;
      this.vertical.x = screenWidth - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      this.vertical.y = Math.max(start, start + vertical.start * actualHeight);
      this.vertical.height = Math.min(actualHeight - start - SCROLLBAR_PADDING * 3, vertical.size * actualHeight);
    } else {
      this.vertical.visible = false;
    }
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.calculate();
  }
}
