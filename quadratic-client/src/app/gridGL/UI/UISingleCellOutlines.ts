//! Draws visible outlines for single cell tables.

import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Graphics } from 'pixi.js';

export class UISingleCellOutlines extends Graphics {
  private _dirty = true;

  constructor() {
    super();

    events.on('setDirty', this.setDirtyHandler);
    events.on('sheetInfoUpdate', this.setDirty);
    events.on('sheetOffsetsUpdated', this.setDirty);
    events.on('resizeHeadingColumn', this.setDirty);
    events.on('resizeHeadingRow', this.setDirty);
    events.on('dataTablesCache', this.setDirty);
  }

  destroy() {
    events.off('setDirty', this.setDirtyHandler);
    events.off('sheetInfoUpdate', this.setDirty);
    events.off('sheetOffsetsUpdated', this.setDirty);
    events.off('resizeHeadingColumn', this.setDirty);
    events.off('resizeHeadingRow', this.setDirty);
    events.off('dataTablesCache', this.setDirty);

    super.destroy();
  }

  get dirty(): boolean {
    return this._dirty;
  }

  setDirtyHandler = (dirty: DirtyObject) => {
    if (dirty.singleCellOutlines) {
      this._dirty = true;
    }
  };

  setDirty = () => {
    this._dirty = true;
  };

  update(dirty: boolean) {
    if (!dirty && !this.dirty) return;

    this._dirty = false;
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
