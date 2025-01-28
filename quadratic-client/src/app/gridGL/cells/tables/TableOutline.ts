//! Draws a table outline, including the spill error boundaries.

import type { Table } from '@/app/gridGL/cells/tables/Table';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Graphics, Rectangle } from 'pixi.js';

const SPILL_HIGHLIGHT_THICKNESS = 1;
const SPILL_FILL_ALPHA = 0.05;

// whether to always show the outline even if the table is not active (this is a temporary fix)
const ALWAYS_SHOW = true;

export class TableOutline extends Graphics {
  private table: Table;

  constructor(table: Table) {
    super();
    this.table = table;

    sharedEvents.on('changeThemeAccentColor', this.update);
  }

  destroy = () => {
    sharedEvents.off('changeThemeAccentColor', this.update);
    super.destroy();
  };

  update = () => {
    this.clear();

    // draw the table selected outline
    const width = this.table.active ? 2 : 1;
    const chart = this.table.codeCell.state === 'HTML';
    if (ALWAYS_SHOW || this.table.codeCell.show_ui || this.table.active) {
      if (!chart) {
        this.lineStyle({
          // TODO: (jimniels) if the table is selected 'primary' otherwise 'muted-foreground
          color: getCSSVariableTint('muted-foreground'),
          width,
          alignment: 0,
        });
        this.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.table.tableBounds.height));
      }
    }

    // create the drag handles
    if (this.table.active && this.table && !this.table.codeCell.readonly) {
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
