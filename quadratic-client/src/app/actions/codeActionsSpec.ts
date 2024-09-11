import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const codeActionsSpec = {
  [Action.CancelExecution]: {
    label: 'Cancel execution',
    run: () => {
      pythonWebWorker.cancelExecution();
      javascriptWebWorker.cancelExecution();
    },
  },
  [Action.ExecuteCode]: {
    label: 'Execute code',
    run: () => {
      quadraticCore.rerunCodeCells(
        sheets.sheet.id,
        pixiAppSettings.editorInteractionState.selectedCell.x,
        pixiAppSettings.editorInteractionState.selectedCell.y,
        sheets.getCursorPosition()
      );
    },
  },
  [Action.RerunSheetCode]: {
    label: 'Rerun sheet code',
    run: () => {
      quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition());
    },
  },
  [Action.RerunAllCode]: {
    label: 'Rerun all code',
    run: () => {
      quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
    },
  },
};
