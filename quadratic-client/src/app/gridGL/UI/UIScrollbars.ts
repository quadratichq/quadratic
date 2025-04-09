//! Draws scrollbars for the grid.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';

const SCROLLBAR_SIZE = 6;
const SCROLLBAR_PADDING = 6;
const SCROLLBAR_COLOR = 0x000000;
const SCROLLBAR_ALPHA = 0.18;

export type Scrollbar = 'horizontal' | 'vertical' | undefined;

export class UIScrollbars extends Container {
  private dirty = true;

  private horizontal = new Sprite(Texture.WHITE);
  private vertical = new Sprite(Texture.WHITE);

  // we need to cache these values since they don't change when dragging the
  // scrollbar
  private actualWidth = 0;
  private actualHeight = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastViewportRight = 0;
  private lastViewportBottom = 0;
  private contentSize: Rectangle | undefined;

  horizontalStart = 0;
  verticalStart = 0;

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

    events.on('sheetInfo', this.setDirty);
    events.on('sheetInfoUpdate', this.setDirty);
    events.on('headingSize', this.setDirty);
    events.on('changeSheet', this.setDirty);
    window.addEventListener('resize', this.setDirty);
  }

  destroy() {
    events.off('sheetInfo', this.setDirty);
    events.off('sheetInfoUpdate', this.setDirty);
    events.off('headingSize', this.setDirty);
    events.off('changeSheet', this.setDirty);
    window.removeEventListener('resize', this.setDirty);
  }

  setDirty = () => (this.dirty = true);

  /**
   * Calculates the start and size of the scrollbar. All parameters are in
   * viewport coordinates. Works for both horizontal and vertical scrollbars.
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
    viewportEnd: number,
    headingSize: number
  ): { start: number; size: number } | undefined {
    const viewportTotal = viewportEnd - viewportStart;

    // If the content is smaller than the viewport, and the viewport is at the
    // start of the content, then the scrollbar is not visible.
    if (
      !pixiApp.pointer.pointerScrollbar.isActive() &&
      viewportTotal >= contentSize &&
      viewportStart === -headingSize / pixiApp.viewport.scaled
    ) {
      return undefined;
    }

    // we use the largest of the content size or the viewport size to calculate
    // the scrollbar size
    const adjustedContentSize = Math.max(contentSize, viewportEnd);
    const start = viewportStart / adjustedContentSize;
    let size: number;
    if (contentSize < viewportTotal) {
      size = contentSize / viewportTotal;
    } else {
      size = viewportTotal / contentSize;
    }
    return { start, size };
  }

  // Calculates the scrollbar positions and sizes
  private calculate() {
    const viewport = pixiApp.viewport;
    const { screenWidth, screenHeight } = viewport;
    const { headingSize } = pixiApp.headings;
    const viewportBounds = viewport.getVisibleBounds();
    const contentSize = sheets.sheet.getScrollbarBounds();
    if (!contentSize) return;
    this.contentSize = contentSize;

    const dragging = pixiApp.pointer.pointerScrollbar.isActive();

    const horizontal = this.calculateSize(
      contentSize.width,
      viewportBounds.left,
      dragging ? this.lastViewportRight : viewportBounds.right,
      headingSize.width
    );
    // don't change the visibility of the horizontal scrollbar when dragging
    if (!dragging) this.horizontal.visible = !!horizontal;

    if (horizontal) {
      const start = headingSize.width;
      this.actualWidth = screenWidth - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      this.horizontal.x = Math.max(start, start + horizontal.start * this.actualWidth);
      if (dragging) {
        this.horizontal.width = this.lastWidth;
      } else {
        this.horizontalStart = start + horizontal.start * this.actualWidth;
        const rightClamp = screenWidth - this.horizontal.x - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        this.horizontal.width = Math.min(rightClamp, horizontal.size * this.actualWidth);
        this.lastWidth = horizontal.size * this.actualWidth;
        this.lastViewportRight = viewportBounds.right;
      }
      this.horizontal.y = screenHeight - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
    }

    const vertical = this.calculateSize(
      contentSize.height,
      viewportBounds.top,
      dragging ? this.lastViewportBottom : viewportBounds.bottom,
      headingSize.height
    );
    // don't change the visibility of the vertical scrollbar when dragging
    if (!dragging) this.vertical.visible = !!vertical;

    if (vertical) {
      const start = headingSize.height;
      this.actualHeight = screenHeight - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      this.vertical.y = Math.max(start, start + vertical.start * this.actualHeight);
      if (dragging) {
        this.vertical.height = this.lastHeight;
      } else {
        this.verticalStart = start + vertical.start * this.actualHeight;
        const bottomClamp = screenHeight - this.vertical.y - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        this.vertical.height = Math.min(bottomClamp, vertical.size * this.actualHeight);
        this.lastHeight = vertical.size * this.actualHeight;
        this.lastViewportBottom = viewportBounds.bottom;
      }
      this.vertical.x = screenWidth - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
    }
  }

  update(forceDirty: boolean) {
    if (pixiAppSettings.gridSettings.hideScrollbars) {
      this.visible = false;
      return;
    }
    this.visible = true;
    if (!this.dirty && !forceDirty) return;
    this.dirty = false;
    this.calculate();
    pixiApp.setViewportDirty();
  }

  /// Returns the scrollbar that the point is over.
  contains(x: number, y: number): Scrollbar {
    const canvasBounds = pixiApp.canvas.getBoundingClientRect();
    const point = new Point(x - canvasBounds.left, y - canvasBounds.top);
    if (
      this.horizontal.visible &&
      intersects.rectanglePoint(
        new Rectangle(this.horizontal.x, this.horizontal.y, this.horizontal.width, this.horizontal.height),
        point
      )
    ) {
      return 'horizontal';
    }
    if (
      this.vertical.visible &&
      intersects.rectanglePoint(
        new Rectangle(this.vertical.x, this.vertical.y, this.vertical.width, this.vertical.height),
        point
      )
    ) {
      return 'vertical';
    }
    return undefined;
  }

  /// Adjusts horizontal scrollbar by the delta. Returns the actual delta that
  /// was applied.
  adjustHorizontal(delta: number): number {
    if (!delta || !this.contentSize) return 0;
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    const viewportScale = pixiApp.viewport.scaled;
    const scaleX = Math.max(this.contentSize.width, viewportBounds.width) / this.actualWidth;
    const last = pixiApp.viewport.x;
    pixiApp.viewport.x -= delta * viewportScale * scaleX;
    pixiApp.viewport.x = Math.min(pixiApp.headings.headingSize.width / viewportScale, pixiApp.viewport.x);
    return (last - pixiApp.viewport.x) / (scaleX * viewportScale);
  }

  /// Adjusts vertical scrollbar by the delta. Returns the actual delta that
  /// was applied.
  adjustVertical(delta: number): number {
    if (!delta || !this.contentSize) return 0;
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    const viewportScale = pixiApp.viewport.scaled;
    const scaleY = Math.max(this.contentSize.height, viewportBounds.height) / this.actualHeight;
    const last = pixiApp.viewport.y;
    pixiApp.viewport.y -= delta * viewportScale * scaleY;
    pixiApp.viewport.y = Math.min(pixiApp.headings.headingSize.height, pixiApp.viewport.y);
    return (last - pixiApp.viewport.y) / (scaleY * viewportScale);
  }
}
