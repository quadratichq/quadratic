import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

type CodeActionSpec = Pick<
  ActionSpecRecord,
  Action.CancelExecution | Action.ExecuteCode | Action.RerunSheetCode | Action.RerunAllCode
>;

export const cancelExecution = () => {
  pythonWebWorker.cancelExecution();
  javascriptWebWorker.cancelExecution();
};

export const executeCode = () => {
  const { x, y } = sheets.sheet.cursor.position;
  const table = pixiApp.cellsSheet().tables.getTableFromTableCell(x, y);
  if (table?.isCodeCell()) {
    quadraticCore.rerunCodeCells(sheets.current, table.codeCell.x, table.codeCell.y, sheets.getCursorPosition());
  }
};

export const rerunSheetCode = () => {
  quadraticCore.rerunCodeCells(sheets.current, undefined, undefined, sheets.getCursorPosition());
};

export const rerunAllCode = () => {
  quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
};

export const codeActionsSpec: CodeActionSpec = {
  [Action.CancelExecution]: {
    label: 'Cancel execution',
    run: cancelExecution,
  },
  [Action.ExecuteCode]: {
    label: 'Execute code',
    run: executeCode,
  },
  [Action.RerunSheetCode]: {
    label: 'Rerun sheet code',
    run: rerunSheetCode,
  },
  [Action.RerunAllCode]: {
    label: 'Rerun all code',
    run: rerunAllCode,
  },
};
