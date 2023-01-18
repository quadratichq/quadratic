import { Cell } from '../../../gridDB/gridTypes';
import { PixiApp } from '../../pixiApp/PixiApp';

export function doubleClickCell(options: { cell?: Cell; app: PixiApp }): void {
  const { cell, app } = options;
  const settings = app.settings;

  if (!settings.setInteractionState || !settings.setEditorInteractionState) return;

  if (cell) {
    if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
      settings.setInteractionState({
        ...settings.interactionState,
        showInput: true,
        inputInitialValue: cell.value,
      });
    } else {
      // Open code editor, or move code editor if already open.
      settings.setEditorInteractionState({
        showCommandPalette: false,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: cell.x, y: cell.y },
        mode: cell.type,
      });
    }
  } else {
    // If no previous value, open single line Input
    settings.setInteractionState({
      ...settings.interactionState,
      showInput: true,
      inputInitialValue: '',
    });
  }
}
