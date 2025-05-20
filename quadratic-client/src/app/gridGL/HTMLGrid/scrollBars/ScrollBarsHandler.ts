//! Adjusts scrollbars for the grid.

// todo: this can be moved near the ScrollBars.tsx component

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Point, Rectangle } from 'pixi.js';

const SCROLLBAR_SIZE = 6;
const SCROLLBAR_PADDING = 6;
const SCROLLBAR_MINIMUM_SIZE = 15;

export type Scrollbar = 'horizontal' | 'vertical' | undefined;

export class ScrollBarsHandler {
  private dirty = true;

  // we need to cache these values since we use the last non-dragged values
  // while dragging the scrollbar
  private scrollbarAreaWidth = 0;
  private scrollbarAreaHeight = 0;
  private horizontalBarWidth = 0;
  private verticalBarHeight = 0;
  private scrollbarScaleX = 0;
  private scrollbarScaleY = 0;
  private lastViewportRight = 0;
  private lastViewportBottom = 0;

  // the scrollbar rectangles
  private horizontal: Rectangle | undefined;
  private vertical: Rectangle | undefined;

  horizontalStart = 0;
  verticalStart = 0;

  private dragging: 'horizontal' | 'vertical' | undefined;

  constructor() {
    events.on('sheetInfo', this.setDirty);
    events.on('sheetInfoUpdate', this.setDirty);
    events.on('headingSize', this.setDirty);
    events.on('changeSheet', this.setDirty);
    events.on('scrollBar', this.setDragging);
    window.addEventListener('resize', this.setDirty);
  }

  destroy() {
    events.off('sheetInfo', this.setDirty);
    events.off('sheetInfoUpdate', this.setDirty);
    events.off('headingSize', this.setDirty);
    events.off('changeSheet', this.setDirty);
    events.off('scrollBar', this.setDragging);
    window.removeEventListener('resize', this.setDirty);
  }

  private setDragging = (state: 'horizontal' | 'vertical' | undefined) => {
    this.dragging = state;
    this.dirty = true;
  };

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
  private calculateSize = (
    contentSize: number,
    viewportStart: number,
    viewportEnd: number,
    headingSize: number
  ): { start: number; size: number } | undefined => {
    const viewportSize = viewportEnd - viewportStart;

    // If the content is smaller than the viewport, and the viewport is at the
    // start of the content, then the scrollbar is not visible.
    if (!this.dragging && viewportSize >= contentSize && viewportStart <= -headingSize / pixiApp.viewport.scaled) {
      return undefined;
    }

    // the scrollbar size can be the content size vs. the viewport, or the
    // relative viewport size vs. the total viewport size
    const adjustedContentSize = Math.max(contentSize, viewportEnd);
    const start = viewportStart / adjustedContentSize;
    let size: number;
    if (contentSize === 0) {
      size = viewportSize / viewportEnd;
    } else if (viewportSize > contentSize) {
      // viewport is larger than the content
      size = contentSize / viewportSize;
    } else if (viewportEnd > contentSize) {
      // viewport is past the end of the content
      size = viewportSize / contentSize;
    } else if (contentSize < viewportSize) {
      // only some of the content would be visible (if on screen)
      size = viewportSize / contentSize;
    } else {
      // content is larger than the viewport
      size = viewportSize / contentSize;
    }

    return { start, size };
  };

  // Calculates the scrollbar positions and sizes
  private calculate = () => {
    const verticalBar = document.querySelector('#grid-scrollbars-vertical') as HTMLDivElement;
    const horizontalBar = document.querySelector('#grid-scrollbars-horizontal') as HTMLDivElement;
    if (!verticalBar || !horizontalBar) return;

    const viewport = pixiApp.viewport;
    const { screenWidth, screenHeight } = viewport;
    const { headingSize } = pixiApp.headings;
    const viewportBounds = viewport.getVisibleBounds();
    const contentSize = sheets.sheet.getScrollbarBounds();
    const dragging = this.dragging;

    const horizontal = this.calculateSize(
      contentSize.width,
      viewportBounds.left,
      dragging ? this.lastViewportRight : viewportBounds.right,
      headingSize.width
    );
    // don't change the visibility of the horizontal scrollbar when dragging
    if (horizontal) {
      const start = headingSize.width;
      this.scrollbarAreaWidth = screenWidth - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const horizontalX = Math.max(start, start + horizontal.start * this.scrollbarAreaWidth);
      let horizontalWidth: number;
      if (dragging === 'horizontal') {
        horizontalWidth = this.horizontalBarWidth;
      } else {
        this.horizontalStart = start + horizontal.start * this.scrollbarAreaWidth;
        const rightClamp = screenWidth - horizontalX - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        this.horizontalBarWidth = horizontal.size * this.scrollbarAreaWidth;
        horizontalWidth = Math.min(rightClamp, this.horizontalBarWidth);
        this.lastViewportRight = viewportBounds.right;

        if (viewportBounds.right < contentSize.width) {
          // adjusts when content is larger than viewport but we are not passed the end of the content
          this.scrollbarScaleX = (viewportBounds.width / this.horizontalBarWidth) * pixiApp.viewport.scaled;
        } else {
          // adjusts when we are past the end of the content
          this.scrollbarScaleX = (viewportBounds.right / this.scrollbarAreaWidth) * pixiApp.viewport.scaled;
        }
      }
      const horizontalY = screenHeight - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      horizontalBar.style.left = `${horizontalX}px`;
      horizontalBar.style.width = `${Math.max(horizontalWidth, SCROLLBAR_MINIMUM_SIZE)}px`;
      horizontalBar.style.display = 'block';
      this.horizontal = new Rectangle(horizontalX, horizontalY, horizontalWidth, SCROLLBAR_SIZE);
    } else {
      this.horizontal = undefined;
      horizontalBar.style.display = 'none';
    }

    const vertical = this.calculateSize(
      contentSize.height,
      viewportBounds.top,
      dragging ? this.lastViewportBottom : viewportBounds.bottom,
      headingSize.height
    );
    // don't change the visibility of the vertical scrollbar when dragging
    if (vertical) {
      const start = headingSize.height;
      this.scrollbarAreaHeight = screenHeight - start - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
      const verticalY = Math.max(start, start + vertical.start * this.scrollbarAreaHeight);
      let verticalHeight: number;
      if (dragging === 'vertical') {
        verticalHeight = this.verticalBarHeight;
      } else {
        this.verticalStart = start + vertical.start * this.scrollbarAreaHeight;
        const bottomClamp = screenHeight - verticalY - SCROLLBAR_PADDING - SCROLLBAR_SIZE;
        this.verticalBarHeight = vertical.size * this.scrollbarAreaHeight;
        verticalHeight = Math.min(bottomClamp, this.verticalBarHeight);
        this.lastViewportBottom = viewportBounds.bottom;

        if (viewportBounds.bottom < contentSize.height) {
          // adjusts when content is larger than viewport but we are not passed the end of the content
          this.scrollbarScaleY = (viewportBounds.height / this.verticalBarHeight) * pixiApp.viewport.scaled;
        } else {
          // adjusts when we are past the end of the content
          this.scrollbarScaleY = (viewportBounds.bottom / this.scrollbarAreaHeight) * pixiApp.viewport.scaled;
        }
      }
      const verticalX = screenWidth - SCROLLBAR_SIZE - SCROLLBAR_PADDING;
      verticalBar.style.display = 'block';
      verticalBar.style.left = `${verticalX}px`;
      verticalBar.style.top = `${verticalY}px`;
      verticalBar.style.height = `${Math.max(verticalHeight, SCROLLBAR_MINIMUM_SIZE)}px`;
      this.vertical = new Rectangle(verticalX, verticalY, SCROLLBAR_SIZE, verticalHeight);
    } else {
      this.vertical = undefined;
      verticalBar.style.display = 'none';
    }
  };

  update = (forceDirty: boolean) => {
    if (!pixiAppSettings.gridSettings.showScrollbars) return;
    if (!this.dirty && !forceDirty) return;
    this.dirty = false;
    this.calculate();
    pixiApp.setViewportDirty();
  };

  /// Returns the scrollbar that the point is over.
  contains = (x: number, y: number): Scrollbar => {
    const canvasBounds = pixiApp.canvas.getBoundingClientRect();
    const point = new Point(x - canvasBounds.left, y - canvasBounds.top);
    if (this.horizontal && intersects.rectanglePoint(this.horizontal, point)) {
      return 'horizontal';
    }
    if (this.vertical && intersects.rectanglePoint(this.vertical, point)) {
      return 'vertical';
    }
    return undefined;
  };

  /// Adjusts horizontal scrollbar by the delta. Returns the actual delta that
  /// was applied.
  adjustHorizontal = (delta: number): number => {
    if (!delta) return 0;
    const last = pixiApp.viewport.x;
    pixiApp.viewport.x -= delta * this.scrollbarScaleX;
    pixiApp.viewport.x = Math.min(pixiApp.headings.headingSize.width, pixiApp.viewport.x);
    return (last - pixiApp.viewport.x) / this.scrollbarScaleX;
  };

  /// Adjusts vertical scrollbar by the delta. Returns the actual delta that
  /// was applied.
  adjustVertical = (delta: number): number => {
    if (!delta) return 0;
    const last = pixiApp.viewport.y;
    pixiApp.viewport.y -= delta * this.scrollbarScaleY;
    pixiApp.viewport.y = Math.min(pixiApp.headings.headingSize.height, pixiApp.viewport.y);
    return (last - pixiApp.viewport.y) / this.scrollbarScaleY;
  };
}
