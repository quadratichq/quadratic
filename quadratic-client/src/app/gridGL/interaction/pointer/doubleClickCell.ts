import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { hasPermissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export async function doubleClickCell(options: {
  column: number;
  row: number;
  language?: CodeCellLanguage;
  cell?: string;
}) {
  if (inlineEditorHandler.isEditingFormula()) return;

  const { language, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = hasPermissionToEditFile(settings.editorInteractionState.permissions);

  if (!settings.setEditorInteractionState || !settings.editorInteractionState) return;

  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) return;

  // Open the correct code editor
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
  }

  // Open the text editor
  else if (hasPermission) {
    const value = await quadraticCore.getCellValue(sheets.sheet.id, column, row);

    // open the calendar pick if the cell is a date
    if (value && ['date', 'date time'].includes(value.kind)) {
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        annotationState: `calendar${value.kind === 'date time' ? '-time' : ''}`,
      });
    }
    settings.changeInput(true, cell);
  }
}
