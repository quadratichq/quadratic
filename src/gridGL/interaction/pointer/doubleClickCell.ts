// import { CodeCellValue } from '../../../quadratic-core/types';
import { pixiAppEvents } from '../../pixiApp/PixiAppEvents';

// todo: fix types

export function doubleClickCell(options: { column: number; row: number; code?: any; cell?: string }): void {
  const { code, cell, column, row } = options;
  const settings = pixiAppEvents.getSettings();

  if (!settings.setEditorInteractionState) return;
  if (code) {
    if (code.language) {
      const mode = code.language === 'Python' ? 'PYTHON' : code.language === 'Formula' ? 'FORMULA' : undefined;
      if (!mode) throw new Error(`Unhandled cell.language ${code.language} in doubleClickCell`);

      // Open code editor, or move code editor if already open.
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: column, y: row },
        mode,
      });
    }
  } else {
    settings.changeInput(true, cell);

    // close CodeEditor if open
    if (settings.editorInteractionState.showCodeEditor) {
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCodeEditor: false,
      });
    }
  }
}
