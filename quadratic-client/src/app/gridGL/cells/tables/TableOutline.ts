//! Draws a table outline, including the spill error boundaries.

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Graphics, Rectangle } from 'pixi.js';

const SPILL_HIGHLIGHT_THICKNESS = 2;
const SPILL_FILL_ALPHA = 0.05;

export class TableOutline extends Graphics {
  private table: Table;
  private active = false;

  constructor(table: Table) {
    super();
    this.table = table;

    sharedEvents.on('changeThemeAccentColor', this.update);
  }

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.update);
    super.destroy();
  }

  activate(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.update();
  }

  update = () => {
    this.clear();

    // draw the table selected outline
    const width = this.active ? 2 : 1;
    const chart = this.table.codeCell.state === 'HTML';
    if (!chart) {
      this.lineStyle({ color: getCSSVariableTint('primary'), width, alignment: 0 });
      this.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.table.tableBounds.height));
    }

    // draw the spill error boundaries
    if (this.active && this.table.codeCell.spill_error) {
      const full = this.table.sheet.getScreenRectangle(
        Number(this.table.codeCell.x),
        Number(this.table.codeCell.y),
        this.table.codeCell.w - 1,
        this.table.codeCell.h - 1
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
  private drawDashedRectangle(rectangle: Rectangle, color: number) {
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
  }
}
