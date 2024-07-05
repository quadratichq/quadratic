import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { hasPermissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function doubleClickCell(options: {
  column: number;
  row: number;
  language?: CodeCellLanguage;
  cell?: string;
}): void {
  const { language, cell, column, row } = options;
  if (inlineEditorHandler.isEditingFormula()) return;
  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) return;
  const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
  if (language) {
    const formula = language === 'Formula';
    if (hasPermission && formula) {
      pixiAppSettings.changeInput(true, cell);
    } else {
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: column, y: row },
        selectedCellSheet: sheets.sheet.id,
        mode: language,
        editorEscapePressed: false,
        waitingForEditorClose: undefined,
      });
    }
  } else if (hasPermission) {
    pixiAppSettings.changeInput(true, cell);
  }
}
