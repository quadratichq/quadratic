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

export class TableOutline extends Graphics {
  private table: Table;

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

  update = () => {
    this.clear();

    if (!pixiAppSettings.showCellTypeOutlines) return;

    // draw the table selected outline
    const width = 1;
    const chart = this.table.codeCell.state === 'HTML';
    if (!chart) {
      this.strokeStyle = {
        color: getCSSVariableTint(this.table.active ? 'primary' : 'muted-foreground'),
        width,
        alignment: 0.5,
      };
      if (!this.table.active || !this.table.codeCell.spill_error) {
        const width = this.table.tableBounds.width;
        const height = this.table.tableBounds.height;
        this.rect(0, 0, width, height);
        this.stroke();
      }
    }

    // create the drag handles

    if (pixiApp.initialized) {
      const world = pixiApp.viewport.getWorld();
      if (this.table.checkHover(world) && !this.table.codeCell.is_code) {
        const cornerHandle = new Rectangle(
          this.table.tableBounds.x + this.table.tableBounds.width - 4,
          this.table.tableBounds.y + this.table.tableBounds.height - 4,
          8,
          8
        );
        const rightHandle = new Rectangle(
          this.table.tableBounds.x + this.table.tableBounds.width - 4,
          this.table.tableBounds.y,
          8,
          this.table.tableBounds.height - 8
        );
        const bottomHandle = new Rectangle(
          this.table.tableBounds.x,
          this.table.tableBounds.y + this.table.tableBounds.height - 4,
          this.table.tableBounds.width - 8,
          8
        );

        pixiApp.pointer.pointerTableResize.selection = cornerHandle;
        pixiApp.pointer.pointerTableResize.selectionRight = rightHandle;
        pixiApp.pointer.pointerTableResize.selectionBottom = bottomHandle;
        pixiApp.pointer.pointerTableResize.tableBounds = this.table.sheet.getColumnRowFromScreen(
          this.table.tableBounds.x,
          this.table.tableBounds.y
        );
        pixiApp.pointer.pointerTableResize.codeCell = this.table.codeCell;
        pixiApp.setViewportDirty();
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
      this.stroke({ color: getCSSVariableTint('primary'), width: 1, alignment: 0 });
    }
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
      this.lineTo(path[i][0], path[i][1]);
      this.stroke({
        width: SPILL_HIGHLIGHT_THICKNESS,
        color,
        texture: i % 2 === 0 ? generatedTextures.dashedHorizontal : generatedTextures.dashedVertical,
      });
    }
    this.rect(minX, minY, maxX - minX, maxY - minY);
    this.fill({ color: colors.cellColorError, alpha: SPILL_FILL_ALPHA });
  };
}
