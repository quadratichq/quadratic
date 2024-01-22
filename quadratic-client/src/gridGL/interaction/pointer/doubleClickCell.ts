import { multiplayer } from '@/multiplayer/multiplayer';
import { CodeCellLanguage } from '@/quadratic-core/types';
import { hasPermissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function doubleClickCell(options: {
  column: number;
  row: number;
  mode?: CodeCellLanguage;
  cell?: string;
}): void {
  const { mode, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = hasPermissionToEditFile(settings.editorInteractionState.permissions);

  if (!settings.setEditorInteractionState) return;

  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) return;

  if (mode) {
    if (settings.editorInteractionState.showCodeEditor) {
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        editorEscapePressed: false,
        showCellTypeMenu: false,
        waitingForEditorClose: {
          selectedCell: { x: column, y: row },
          selectedCellSheet: sheets.sheet.id,
          mode,
          showCellTypeMenu: !mode,
        },
      });
    } else {
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: column, y: row },
        selectedCellSheet: sheets.sheet.id,
        mode,
        editorEscapePressed: false,
        waitingForEditorClose: undefined,
      });
    }
  } else if (hasPermission) {
    settings.changeInput(true, cell);
  }
}
