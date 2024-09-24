import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const openCodeEditor = async () => {
  const { setEditorInteractionState, setCodeEditorState } = pixiAppSettings;
  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
  }

  if (!setCodeEditorState) {
    throw new Error('Expected setCodeEditorState to be defined in openCodeEditor');
  }

  // close diff editor if open
  setCodeEditorState((prev) => ({
    ...prev,
    modifiedEditorContent: undefined,
  }));

  const cursorPosition = sheets.sheet.cursor.cursorPosition;
  const { x, y } = cursorPosition;
  const cell = await quadraticCore.getRenderCell(sheets.sheet.id, x, y);

  setEditorInteractionState((prev) => {
    if (cell?.language) {
      return {
        ...prev,
        waitingForEditorClose: {
          selectedCellSheet: sheets.sheet.id,
          selectedCell: { x, y },
          mode: cell.language,
          showCellTypeMenu: !prev.showCodeEditor,
          initialCode: undefined,
        },
      };
    } else if (prev.showCodeEditor) {
      // code editor is already open, so check it for save before closing
      return {
        ...prev,
        waitingForEditorClose: {
          showCellTypeMenu: true,
          selectedCellSheet: sheets.sheet.id,
          selectedCell: { x, y },
          mode: 'Python',
          initialCode: undefined,
        },
      };
    } else {
      // just open the code editor selection menu
      return {
        ...prev,
        showCellTypeMenu: true,
        selectedCellSheet: sheets.sheet.id,
        selectedCell: { x, y },
        mode: undefined,
        initialCode: undefined,
      };
    }
  });
};
