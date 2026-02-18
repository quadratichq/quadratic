//! Draws a table outline, including the spill error boundaries.

import { events } from '@/app/events/events';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Graphics, Rectangle } from 'pixi.js';

const SPILL_HIGHLIGHT_THICKNESS = 1;
const SPILL_FILL_ALPHA = 0.05;

// opacity of the running table outline
const RUNNING_ALPHA_TIME = 150;
const RUNNING_ALPHA_MIN = 0.4;
const RUNNING_ALPHA_MAX = 1.0;

export class TableOutline extends Graphics {
  private table: Table;

  running: boolean | 'awaiting' = false;
  multiplayerUserColor?: number; // Color of the multiplayer user running code (if any)

  constructor(table: Table) {
    super();
    this.table = table;

    sharedEvents.on('changeThemeAccentColor', this.update);
    events.on('gridSettings', this.update);
  }

  destroy = () => {
    sharedEvents.off('changeThemeAccentColor', this.update);
    events.off('gridSettings', this.update);
    super.destroy();
  };

  update = (runningCount?: number) => {
    this.clear();

    // Apply dimming effect when running OR awaiting (static dim, no animation)
    if (this.running === true || this.running === 'awaiting') {
      // If actually running, use animated dimming
      if (this.running === true && runningCount) {
        const running = runningCount % RUNNING_ALPHA_TIME;
        let change = 0;
        if (running < RUNNING_ALPHA_TIME / 2) {
          change = running / (RUNNING_ALPHA_TIME / 2);
        } else {
          change = 1 - (running - RUNNING_ALPHA_TIME / 2) / (RUNNING_ALPHA_TIME / 2);
        }
        // Visibility goes from MAX (fully visible) to MIN (dimmed)
        // Overlay alpha is inverted: 1 - visibility
        const visibility = RUNNING_ALPHA_MIN + (RUNNING_ALPHA_MAX - RUNNING_ALPHA_MIN) * change;
        const overlayAlpha = 1 - visibility;
        this.beginFill(getCSSVariableTint('background'), overlayAlpha);
        this.drawRect(0, 0, this.table.tableBounds.width, this.table.tableBounds.height);
        this.endFill();
      } else {
        // If awaiting, use static dimming (average visibility, then invert for overlay)
        const visibility = (RUNNING_ALPHA_MIN + RUNNING_ALPHA_MAX) / 2;
        const overlayAlpha = 1 - visibility;
        this.beginFill(getCSSVariableTint('background'), overlayAlpha);
        this.drawRect(0, 0, this.table.tableBounds.width, this.table.tableBounds.height);
        this.endFill();
      }
    }

    if (!pixiAppSettings.showCellTypeOutlines) return;

    // draw the table selected outline
    const width = 1;
    const chart = this.table.codeCell.state === 'HTML';
    if (!chart) {
      // If multiplayer code is running, use the user's color for the outline
      const outlineColor = this.multiplayerUserColor
        ? this.multiplayerUserColor
        : getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground');
      const outlineWidth = this.multiplayerUserColor ? 2 : width; // Thicker outline for multiplayer

      this.lineStyle({
        color: outlineColor,
        width: outlineWidth,
        alignment: 0.5,
      });
      if (!this.table.active || !this.table.codeCell.spill_error) {
        const width = this.table.tableBounds.width;
        const height = this.table.tableBounds.height;
        this.drawShape(new Rectangle(0, 0, width, height));
      }
    }

    // draw the spill error boundaries
    if (this.table.active && this.table.codeCell.spill_error) {
      const full = this.table.sheet.getScreenRectangle(
        this.table.codeCell.x,
        this.table.codeCell.y,
        this.table.codeCell.w,
        this.table.codeCell.h
      );

      // draw outline around where the code cell would spill
      this.lineStyle({ color: getCSSVariableTint('primary'), width: 1, alignment: 0 });
      const image = this.table.codeCell.state === 'Image';
      this.drawRect(
        0,
        0,
        chart || image ? this.table.codeCell.w : full.width,
        chart || image ? this.table.codeCell.h : full.height
      );

      // box and shade what is causing the spill errors
      this.table.codeCell.spill_error.forEach((error) => {
        const x = Number(error.x);
        const y = Number(error.y);

        // Check if this position is a merged cell anchor
        const mergeRect = this.table.sheet.getMergeCellRect(x, y);

        let rectangle: Rectangle;
        if (mergeRect) {
          // If it's a merged cell, draw the border around the entire merged cell
          rectangle = this.table.sheet.getScreenRectangle(
            Number(mergeRect.min.x),
            Number(mergeRect.min.y),
            Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
            Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
          );
        } else {
          // Otherwise, draw the border around just this cell
          rectangle = this.table.sheet.getCellOffsets(x, y);
        }

        this.drawDashedRectangle(rectangle, colors.cellColorError);
      });
    }

    pixiApp.setViewportDirty();
  };

  // draw a dashed and filled rectangle to identify the cause of the spill error
  private drawDashedRectangle = (rectangle: Rectangle, color: number) => {
    const minX = rectangle.left - this.table.tableBounds.x;
    const minY = rectangle.top - this.table.tableBounds.y;
    const maxX = rectangle.right - this.table.tableBounds.x;
    const maxY = rectangle.bottom - this.table.tableBounds.y;

    const path = [
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ];

    this.moveTo(minX, minY);
    for (let i = 0; i < path.length; i++) {
      this.lineStyle({
        width: SPILL_HIGHLIGHT_THICKNESS,
        color,
        texture: i % 2 === 0 ? generatedTextures.dashedHorizontal : generatedTextures.dashedVertical,
      });
      this.lineTo(path[i][0], path[i][1]);
    }
    this.lineStyle();
    this.beginFill(colors.cellColorError, SPILL_FILL_ALPHA);
    this.drawRect(minX, minY, maxX - minX, maxY - minY);
    this.endFill();
  };
}
