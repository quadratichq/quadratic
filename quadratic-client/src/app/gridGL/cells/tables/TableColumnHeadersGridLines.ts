//! Draws the grid lines for column headers when they are sticky.

import { Table } from '@/app/gridGL/cells/tables/Table';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Graphics } from 'pixi.js';

export class TableColumnHeadersGridLines extends Graphics {
  private table: Table;

  constructor(table: Table) {
    super();
    this.table = table;
  }

  update() {
    this.clear();
    if (pixiAppSettings.showGridLines && pixiApp.gridLines?.visible) {
      const { y0, y1, lines } = this.table.getColumnHeaderLines();
      const currentLineStyle = pixiApp.gridLines.currentLineStyle;
      if (!currentLineStyle) return;

      if (pixiApp.cellsSheet().tables.isActive(this.table)) {
        console.log('active?');
        this.lineStyle({ color: getCSSVariableTint('primary'), width: 2, alignment: 0 });
      } else {
        this.lineStyle(currentLineStyle);
      }

      lines.forEach((line) => {
        this.moveTo(line, y0).lineTo(line, y1);
      });
    }
  }
}
