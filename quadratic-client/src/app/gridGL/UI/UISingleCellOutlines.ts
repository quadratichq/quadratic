//! Draws visible outlines for single cell tables.

import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Graphics } from 'pixi.js';

export class UISingleCellOutlines extends Graphics {
  dirty = true;

  update(dirty: boolean) {
    if (!dirty && !this.dirty) return;

    this.dirty = false;
    this.clear();

    if (!pixiAppSettings.showCellTypeOutlines) return;

    const tables = pixiApp.cellsSheet().tables;
    const bounds = pixiApp.viewport.getVisibleBounds();
    const boundsCells = sheets.sheet.getRectangleFromScreen(bounds);

    const singleCellTables = tables.getSingleCellTablesInRectangle(boundsCells);

    this.lineStyle({ color: getCSSVariableTint('muted-foreground'), width: 1, alignment: 0.5 });
    for (const table of singleCellTables) {
      const offsets = sheets.sheet.getCellOffsets(table.x, table.y);
      this.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);
    }
  }
}
