import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const openCodeEditor = async () => {
  const { editorInteractionState, setEditorInteractionState } = pixiAppSettings;
  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
  }
  const cursorPosition = sheets.sheet.cursor.cursorPosition;

  const x = cursorPosition.x;
  const y = cursorPosition.y;
  const cell = await quadraticCore.getRenderCell(sheets.sheet.id, x, y);
  if (cell?.language) {
    if (editorInteractionState.showCodeEditor) {
      // Open code editor, or move change editor if already open.
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: false,
        waitingForEditorClose: {
          selectedCell: { x: x, y: y },
          selectedCellSheet: sheets.sheet.id,
          mode: cell.language,
          showCellTypeMenu: false,
          initialCode: undefined,
        },
      });
    } else {
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: false,
        selectedCell: { x: x, y: y },
        selectedCellSheet: sheets.sheet.id,
        mode: cell.language,
        showCodeEditor: true,
        initialCode: undefined,
      });
    }
  } else if (editorInteractionState.showCodeEditor) {
    // code editor is already open, so check it for save before closing
    setEditorInteractionState({
      ...editorInteractionState,
      waitingForEditorClose: {
        showCellTypeMenu: true,
        selectedCell: { x: x, y: y },
        selectedCellSheet: sheets.sheet.id,
        mode: 'Python',
        initialCode: undefined,
      },
    });
  } else {
    // just open the code editor selection menu
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: true,
      selectedCell: { x: x, y: y },
      selectedCellSheet: sheets.sheet.id,
      mode: undefined,
      initialCode: undefined,
    });
  }
};
