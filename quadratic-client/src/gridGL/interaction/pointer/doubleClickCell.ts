import { CodeCellLanguage } from '@/quadratic-core/types';
import { hasPerissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function doubleClickCell(options: {
  column: number;
  row: number;
  mode?: CodeCellLanguage;
  cell?: string;
}): void {
  const { mode, cell, column, row } = options;
  const settings = pixiAppSettings;

  const hasPermission = hasPerissionToEditFile(settings.editorInteractionState.permissions);

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
