import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';

export function doubleClickCell(options: {
  column: number;
  row: number;
  language?: CodeCellLanguage;
  cell?: string;
}): void {
  if (inlineEditorHandler.isEditingFormula()) return;

  const { language, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = hasPermissionToEditFile(settings.editorInteractionState.permissions);

  if (!settings.setEditorInteractionState) return;

  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) return;

  if (language) {
    const formula = language === 'Formula';

    if (settings.editorInteractionState.showCodeEditor) {
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        editorEscapePressed: false,
        showCellTypeMenu: false,
        waitingForEditorClose: {
          selectedCell: { x: column, y: row },
          selectedCellSheet: sheets.sheet.id,
          mode: language,
          showCellTypeMenu: !language,
          inlineEditor: formula,
        },
      });
    } else {
      if (hasPermission && formula) {
        const cursor = sheets.sheet.cursor.cursorPosition;

        // ensure we're in the right cell (which may change if we double clicked on a CodeRun)
        if (cursor.x !== column || cursor.y !== row) {
          sheets.sheet.cursor.changePosition({ cursorPosition: { x: column, y: row } });
        }
        settings.changeInput(true, cell);
      } else {
        settings.setEditorInteractionState({
          ...settings.editorInteractionState,
          showCellTypeMenu: false,
          showCodeEditor: true,
          selectedCell: { x: column, y: row },
          selectedCellSheet: sheets.sheet.id,
          mode: language,
          editorEscapePressed: false,
          waitingForEditorClose: undefined,
        });
      }
    }
  } else if (hasPermission) {
    settings.changeInput(true, cell);
  }
}
