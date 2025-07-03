import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { SaveAndRunIcon } from '@/shared/components/Icons';

type CodeActionSpec = Pick<
  ActionSpecRecord,
  Action.CancelExecution | Action.ExecuteCode | Action.RerunSheetCode | Action.RerunAllCode
>;

export const cancelExecution = () => {
  pythonWebWorker.cancelExecution();
  javascriptWebWorker.cancelExecution();
};

export const executeCode = () => {
  const selection = sheets.sheet.cursor.a1String();
  quadraticCore.rerunCodeCells(sheets.current, selection, sheets.getCursorPosition());
};

export const rerunSheetCode = () => {
  quadraticCore.rerunCodeCells(sheets.current, undefined, sheets.getCursorPosition());
};

export const rerunAllCode = () => {
  quadraticCore.rerunCodeCells(undefined, undefined, sheets.getCursorPosition());
};

export const codeActionsSpec: CodeActionSpec = {
  [Action.CancelExecution]: {
    label: () => 'Cancel execution',
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      cancelExecution();
    },
  },
  [Action.ExecuteCode]: {
    label: () => 'Run code',
    Icon: SaveAndRunIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      executeCode();
    },
  },
  [Action.RerunSheetCode]: {
    label: () => 'Run sheet code',
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      rerunSheetCode();
    },
  },
  [Action.RerunAllCode]: {
    label: () => 'Run all code',
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      rerunAllCode();
    },
  },
};
