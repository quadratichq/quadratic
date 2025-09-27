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

const RUNNING_ALPHA_TIME = 250;

export class TableOutline extends Graphics {
  private table: Table;

  running: boolean | 'awaiting' = false;

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

    if (this.running && runningCount) {
      const running = runningCount % RUNNING_ALPHA_TIME;
      let change = 0;
      if (running < RUNNING_ALPHA_TIME / 2) {
        change = running / (RUNNING_ALPHA_TIME / 2);
      } else {
        change = 1 - (running - RUNNING_ALPHA_TIME / 2) / (RUNNING_ALPHA_TIME / 2);
      }
      this.beginFill(getCSSVariableTint('background'), 0.75 * change);
      this.drawRect(0, 0, this.table.tableBounds.width, this.table.tableBounds.height);
      this.endFill();
    }

    if (!pixiAppSettings.showCellTypeOutlines) return;

    // draw the table selected outline
    const width = 1;
    const chart = this.table.codeCell.state === 'HTML';
    if (!chart) {
      this.lineStyle({
        color: getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground'),
        width,
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
        const rectangle = this.table.sheet.getCellOffsets(Number(error.x), Number(error.y));
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
