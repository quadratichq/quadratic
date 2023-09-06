import { pixiAppEvents } from '../../gridGL/pixiApp/PixiAppEvents';
import { Rect, SheetId, TransactionSummary } from '../../quadratic-core/types';
import { SheetCursorSave } from '../sheet/SheetCursor';
import { rectToRectangle } from './Grid';
import { SheetController } from './SheetController';

export const transactionResponse = (sheetController: SheetController, summary: TransactionSummary): void => {
  if (summary.sheet_list_modified) {
    sheetController.sheets.repopulate();
  }
  if (summary.cell_regions_modified) {
    summary.cell_regions_modified.forEach((region: [SheetId, Rect]) => {
      const rectangle = rectToRectangle(region[1]);
      pixiAppEvents.cellsChanged(region[0].id, rectangle);
    });
  }

  if (summary.fill_sheets_modified.length) {
    pixiAppEvents.fillsChanged(summary.fill_sheets_modified);
  }
  const cursor = summary.cursor ? (JSON.parse(summary.cursor) as SheetCursorSave) : undefined;
  if (cursor) {
    sheetController.sheets.current = cursor.sheetId;
    sheetController.sheet.cursor.load(cursor);
  }
  pixiAppEvents.setViewportDirty();
};
