import { isEditorOrAbove } from '../../../actions';
import { Cell } from '../../../schemas';
import { PixiApp } from '../../pixiApp/PixiApp';

export function doubleClickCell(options: { cell?: Cell; app: PixiApp }): void {
  const { cell, app } = options;
  const settings = app.settings;

  if (!settings.setInteractionState || !settings.setEditorInteractionState) return;

  const hasPermission = isEditorOrAbove(settings.editorInteractionState.permission);

  if (cell) {
    if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
      if (hasPermission) {
        settings.setInteractionState({
          ...settings.interactionState,
          showInput: true,
          inputInitialValue: cell.value,
        });
      }
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
  } else if (hasPermission) {
    // If no previous value, open single line Input
    settings.setInteractionState({
      ...settings.interactionState,
      showInput: true,
      inputInitialValue: '',
    });
  }
}
