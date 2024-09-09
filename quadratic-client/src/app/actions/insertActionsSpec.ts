import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

export const insertActionsSpec: ActionSpecRecord = {
  [Action.InsertCodePython]: {
    label: 'Python',
    labelVerbose: 'Insert Python code',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Python',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      }));
    },
  },
  [Action.InsertCodeJavascript]: {
    label: 'JavaScript',
    labelVerbose: 'Insert JavaScript code',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Javascript',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      }));
    },
  },
  [Action.InsertCodeFormula]: {
    label: 'Formula',
    labelVerbose: 'Insert Formula',
    run: () => {
      // if (!pixiAppSettings.setInlineEditorState) return;
      // pixiAppSettings.setInlineEditorState((prev) => ({
      //   ...prev,
      //   visible: true,
      //   formula: true,
      // }));
      // quadraticCore.setCellValue(
      //   sheets.sheet.id,
      //   sheets.sheet.cursor.cursorPosition.x,
      //   sheets.sheet.cursor.cursorPosition.y,
      //   '=',
      //   sheets.getCursorPosition()
      // );
    },
  },
};
