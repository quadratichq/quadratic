import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { TransactionSummary } from '../../quadratic-core/types';
import { SheetCursorSave } from '../sheet/SheetCursor';
import { sheets } from './Sheets';

export const transactionResponse = (summary?: TransactionSummary): void => {
  if (!summary) return;
  if (summary.sheet_list_modified) {
    sheets.repopulate();
  }

  if (summary.cell_hash_values_modified.length) {
    pixiApp.cellsSheets.cellsHashModified(summary.cell_hash_values_modified);
  }

  if (summary.fill_sheets_modified.length) {
    pixiApp.cellsSheets.updateFills(summary.fill_sheets_modified);
  }

  if (summary.offsets_modified.length) {
    sheets.updateOffsets(summary.offsets_modified);
  }

  const cursor = summary.cursor ? (JSON.parse(summary.cursor) as SheetCursorSave) : undefined;
  if (cursor) {
    sheets.current = cursor.sheetId;
    sheets.sheet.cursor.load(cursor);
  }
  pixiApp.setViewportDirty();
};
