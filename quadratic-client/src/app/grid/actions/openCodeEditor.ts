import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const openCodeEditor = async () => {
  const { codeEditorState, setCodeEditorState, setEditorInteractionState } = pixiAppSettings;
  if (!setCodeEditorState) {
    throw new Error('Expected setCodeEditorState to be defined in openCodeEditor');
  }

  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
  }

  const { x, y } = sheets.sheet.cursor.cursorPosition;
  const cell = await quadraticCore.getRenderCell(sheets.sheet.id, x, y);
  if (cell?.language) {
    setCodeEditorState({
      ...codeEditorState,
      modifiedEditorContent: undefined,
      waitingForEditorClose: {
        location: {
          sheetId: sheets.current,
          pos: { x, y },
        },
        language: cell.language,
        showCellTypeMenu: !codeEditorState.showCodeEditor,
        initialCode: undefined,
      },
    });
  } else if (codeEditorState.showCodeEditor) {
    // code editor is already open, so check it for save before closing
    setCodeEditorState({
      ...codeEditorState,
      modifiedEditorContent: undefined,
      waitingForEditorClose: {
        location: {
          sheetId: sheets.current,
          pos: { x, y },
        },
        language: 'Python',
        showCellTypeMenu: true,
        initialCode: undefined,
      },
    });
  } else {
    // just open the code editor selection menu
    setEditorInteractionState((prev) => ({
      ...prev,
      showCellTypeMenu: true,
    }));
    setCodeEditorState({
      ...codeEditorState,
      modifiedEditorContent: undefined,
      location: {
        sheetId: sheets.current,
        pos: { x, y },
      },
    });
  }
};
