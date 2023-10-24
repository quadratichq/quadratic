import { isEditorOrAbove } from '../../../actions';
import { CodeCellLanguage } from '../../../quadratic-core/quadratic_core';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function doubleClickCell(options: {
  column: number;
  row: number;
  mode?: CodeCellLanguage.Python | CodeCellLanguage.Formula;
  cell?: string;
}): void {
  const { mode, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = isEditorOrAbove(settings.editorInteractionState.permission);

  if (!settings.setEditorInteractionState) return;
  if (mode) {
    settings.setEditorInteractionState({
      ...settings.editorInteractionState,
      showCellTypeMenu: false,
      showCodeEditor: true,
      selectedCell: { x: column, y: row },
      mode,
    });
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
