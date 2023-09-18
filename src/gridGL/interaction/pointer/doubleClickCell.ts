// import { CodeCellValue } from '../../../quadratic-core/types';
import { isEditorOrAbove } from '../../../actions';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

// todo: fix code types

export function doubleClickCell(options: { column: number; row: number; code?: any; cell?: string }): void {
  const { code, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = isEditorOrAbove(settings.editorInteractionState.permission);

  if (!settings.setEditorInteractionState) return;
  if (code) {
    if (code.language) {
      const mode = code.language === 'Python' ? 'PYTHON' : code.language === 'Formula' ? 'FORMULA' : undefined;
      if (!mode) throw new Error(`Unhandled cell.language ${code.language} in doubleClickCell`);
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: column, y: row },
        mode,
      });
    }
  } else if (hasPermission) {
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
