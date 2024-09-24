import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const openCodeEditor = async () => {
  const { editorInteractionState, setEditorInteractionState } = pixiAppSettings;
  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
  }
  const cursorPosition = sheets.sheet.cursor.cursorPosition;
  const { x, y } = cursorPosition;
  const cell = await quadraticCore.getRenderCell(sheets.sheet.id, x, y);
  if (cell?.language) {
    setEditorInteractionState({
      ...editorInteractionState,
      waitingForEditorClose: {
        selectedCellSheet: sheets.sheet.id,
        selectedCell: { x, y },
        mode: cell.language,
        showCellTypeMenu: !editorInteractionState.showCodeEditor,
        initialCode: undefined,
      },
    });
  } else if (editorInteractionState.showCodeEditor) {
    // code editor is already open, so check it for save before closing
    setEditorInteractionState({
      ...editorInteractionState,
      waitingForEditorClose: {
        showCellTypeMenu: true,
        selectedCellSheet: sheets.sheet.id,
        selectedCell: { x, y },
        mode: 'Python',
        initialCode: undefined,
      },
    });
  } else {
    // just open the code editor selection menu
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: true,
      selectedCellSheet: sheets.sheet.id,
      selectedCell: { x, y },
      mode: undefined,
      initialCode: undefined,
    });
  }
};
