import { JsRenderCell } from '../../../quadratic-core/types';
import { PixiApp } from '../../pixiApp/PixiApp';

export function doubleClickCell(options: { cell?: JsRenderCell; app: PixiApp }): void {
  const { cell, app } = options;
  const settings = app.settings;

  if (!settings.setEditorInteractionState) return;
  if (cell) {
    if (cell.language) {
      const mode = cell.language === 'Python' ? 'PYTHON' : cell.language === 'Formula' ? 'FORMULA' : undefined;
      if (!mode) throw new Error(`Unhandled cell.language ${cell.language} in doubleClickCell`);

      // Open code editor, or move code editor if already open.
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: Number(cell.x), y: Number(cell.y) },
        mode,
      });
      return;
    } else {
      settings.changeInput(true, cell.value);
    }
  } else {
    // If no previous value, open single line Input
    settings.changeInput(true);
  }

  // close CodeEditor if open
  if (settings.editorInteractionState.showCodeEditor) {
    settings.setEditorInteractionState({
      ...settings.editorInteractionState,
      showCodeEditor: false,
    });
  }
}
