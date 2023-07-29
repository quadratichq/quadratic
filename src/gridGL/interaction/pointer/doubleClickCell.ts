import { Cell } from '../../../schemas';
import { PixiApp } from '../../pixiApp/PixiApp';

export function doubleClickCell(options: { cell?: Cell; app: PixiApp }): void {
  const { cell, app } = options;
  const settings = app.settings;

  if (!settings.setEditorInteractionState) return;
  if (cell) {
    if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
      settings.changeInput(true, cell.value);
    } else {
      // Open code editor, or move code editor if already open.
      settings.setEditorInteractionState({
        ...settings.editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: cell.x, y: cell.y },
        mode: cell.type,
      });
    }
  } else {
    // If no previous value, open single line Input
    settings.changeInput(true);
  }
}
