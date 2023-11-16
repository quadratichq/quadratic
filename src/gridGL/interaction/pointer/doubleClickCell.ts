import { isEditorOrAbove } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function doubleClickCell(options: {
  column: number;
  row: number;
  mode?: 'PYTHON' | 'FORMULA';
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
      selectedCellSheet: sheets.sheet.id,
      mode,
    });
  } else if (hasPermission) {
    settings.changeInput(true, cell);
  }
}
