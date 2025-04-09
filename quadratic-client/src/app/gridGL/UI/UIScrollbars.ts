//! Draws scrollbars for the grid.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Graphics, Point, Rectangle } from 'pixi.js';

const SCROLLBAR_SIZE = 6;
const SCROLLBAR_PADDING = 6;
const SCROLLBAR_COLOR = 0x000000;
const SCROLLBAR_ALPHA = 0.18;
const SCROLLBAR_ROUNDED = 3;

export type Scrollbar = 'horizontal' | 'vertical' | undefined;

export class UIScrollbars extends Graphics {
  private dirty = true;

  // we need to cache these values since they don't change when dragging the
  // scrollbar
  private actualWidth = 0;
  private actualHeight = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastViewportRight = 0;
  private lastViewportBottom = 0;
  private scaleX = 0;
  private scaleY = 0;

  private horizontal: Rectangle | undefined;
  private vertical: Rectangle | undefined;

  horizontalStart = 0;
  verticalStart = 0;

  constructor() {
    super();

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
      viewportStart <= -headingSize / pixiApp.viewport.scaled
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

    const dragging = pixiApp.pointer.pointerScrollbar.isActive();

    const horizontal = this.calculateSize(
      contentSize.width,
      viewportBounds.left,
      dragging ? this.lastViewportRight : viewportBounds.right,
      headingSize.width
    );

    // don't change the visibility of the horizontal scrollbar when dragging
    if (horizontal && (!dragging || this.horizontal)) {
      const start = headingSize.width;
      this.actualWidth = screenWidth - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const horizontalX = Math.max(start, start + horizontal.start * this.actualWidth);
      let horizontalWidth: number;
      if (dragging) {
        horizontalWidth = this.lastWidth;
      } else {
        this.horizontalStart = start + horizontal.start * this.actualWidth;
        const rightClamp = screenWidth - horizontalX - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        horizontalWidth = Math.min(rightClamp, horizontal.size * this.actualWidth);
        this.lastWidth = horizontal.size * this.actualWidth;
        this.lastViewportRight = viewportBounds.right;

        // adjust scale whether the scale is based on total content or partial
        // content vs. viewport
        if (contentSize.width < viewportBounds.width) {
          this.scaleX = (contentSize.width / (horizontal.size * this.actualWidth)) * pixiApp.viewport.scaled;
        } else {
          this.scaleX = (viewportBounds.width / (horizontal.size * this.actualWidth)) * pixiApp.viewport.scaled;
        }
      }
      const horizontalY = screenHeight - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      this.beginFill(SCROLLBAR_COLOR, SCROLLBAR_ALPHA);
      this.drawRoundedRect(horizontalX, horizontalY, horizontalWidth, SCROLLBAR_SIZE, SCROLLBAR_ROUNDED);
      this.endFill();
      this.horizontal = new Rectangle(horizontalX, horizontalY, horizontalWidth, SCROLLBAR_SIZE);
    } else {
      this.horizontal = undefined;
    }

    const vertical = this.calculateSize(
      contentSize.height,
      viewportBounds.top,
      dragging ? this.lastViewportBottom : viewportBounds.bottom,
      headingSize.height
    );

    // don't change the visibility of the vertical scrollbar when dragging
    if (vertical && (!dragging || this.vertical)) {
      const start = headingSize.height;
      this.actualHeight = screenHeight - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const verticalY = Math.max(start, start + vertical.start * this.actualHeight);
      let verticalHeight: number;
      if (dragging) {
        verticalHeight = this.lastHeight;
      } else {
        this.verticalStart = start + vertical.start * this.actualHeight;
        const bottomClamp = screenHeight - verticalY - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        verticalHeight = Math.min(bottomClamp, vertical.size * this.actualHeight);
        this.lastHeight = vertical.size * this.actualHeight;
        this.lastViewportBottom = viewportBounds.bottom;

        // adjust scale whether the scale is based on total content or partial
        // content vs. viewport
        if (contentSize.height < viewportBounds.height) {
          this.scaleY = (contentSize.height / (vertical.size * this.actualHeight)) * pixiApp.viewport.scaled;
        } else {
          this.scaleY = (viewportBounds.height / (vertical.size * this.actualHeight)) * pixiApp.viewport.scaled;
        }
      }
      const verticalX = screenWidth - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      this.beginFill(SCROLLBAR_COLOR, SCROLLBAR_ALPHA);
      this.drawRoundedRect(verticalX, verticalY, SCROLLBAR_SIZE, verticalHeight, SCROLLBAR_ROUNDED);
      this.vertical = new Rectangle(verticalX, verticalY, SCROLLBAR_SIZE, verticalHeight);
      this.endFill();
    } else {
      this.vertical = undefined;
    }
  }

  update(forceDirty: boolean) {
    this.clear();
    if (pixiAppSettings.gridSettings.hideScrollbars) return;
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
      this.horizontal &&
      intersects.rectanglePoint(
        new Rectangle(this.horizontal.x, this.horizontal.y, this.horizontal.width, this.horizontal.height),
        point
      )
    ) {
      return 'horizontal';
    }
    if (
      this.vertical &&
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
    if (!delta) return 0;
    const last = pixiApp.viewport.x;
    pixiApp.viewport.x -= delta * this.scaleX;
    pixiApp.viewport.x = Math.min(pixiApp.headings.headingSize.width, pixiApp.viewport.x);
    return (last - pixiApp.viewport.x) / this.scaleX;
  }

  /// Adjusts vertical scrollbar by the delta. Returns the actual delta that
  /// was applied.
  adjustVertical(delta: number): number {
    if (!delta) return 0;
    const last = pixiApp.viewport.y;
    pixiApp.viewport.y -= delta * this.scaleY;
    pixiApp.viewport.y = Math.min(pixiApp.headings.headingSize.height, pixiApp.viewport.y);
    return (last - pixiApp.viewport.y) / this.scaleY;
  }
}
