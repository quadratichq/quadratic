import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export async function doubleClickCell(options: {
  column: number;
  row: number;
  language?: CodeCellLanguage;
  cell?: string;
}) {
  const { language, cell, column, row } = options;

  if (inlineEditorHandler.isEditingFormula()) return;
  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) return;
  if (!pixiAppSettings.setEditorInteractionState || !pixiAppSettings.editorInteractionState) return;
  const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);

  // Open the correct code editor
  if (language) {
    const formula = language === 'Formula';

    if (pixiAppSettings.editorInteractionState.showCodeEditor) {
      pixiAppSettings.setEditorInteractionState({
        ...pixiAppSettings.editorInteractionState,
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
        pixiAppSettings.changeInput(true, cell);
      } else {
        pixiAppSettings.setEditorInteractionState({
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
    }
  }

  // Open the text editor
  else if (hasPermission) {
    const value = await quadraticCore.getCellValue(sheets.sheet.id, column, row);

    // open the calendar pick if the cell is a date
    if (value && ['date', 'date time'].includes(value.kind)) {
      pixiAppSettings.setEditorInteractionState({
        ...pixiAppSettings.editorInteractionState,
        annotationState: `calendar${value.kind === 'date time' ? '-time' : ''}`,
      });
    }
    pixiAppSettings.changeInput(true, cell);
  }
}
