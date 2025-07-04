import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

export const openCodeEditor = async () => {
  const { codeEditorState, setCodeEditorState, setEditorInteractionState } = pixiAppSettings;
  if (!setCodeEditorState) {
    throw new Error('Expected setCodeEditorState to be defined in openCodeEditor');
  }

  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in openCodeEditor');
  }

  // abort any ongoing AI assistant requests and clear the messages
  codeEditorState.aiAssistant.abortController?.abort();

  const { x, y } = sheets.sheet.cursor.position;
  const codeCell = pixiApp.cellsSheet().tables.getCodeCellIntersects({ x, y });
  if (codeCell) {
    const {
      codeCell: {
        pos: { x: openX, y: openY },
        language: openLanguage,
        sheetId: openSheetId,
      },
    } = codeEditorState;

    // check if the code editor is already open on the same cell
    const closeCodeEditor =
      codeEditorState.showCodeEditor &&
      openX === x &&
      openY === y &&
      openLanguage === codeCell.language &&
      openSheetId === sheets.current;

    if (closeCodeEditor) {
      // if the code editor is already open on the same cell, then close it
      // this open save changes modal if there are unsaved changes
      setCodeEditorState({
        ...codeEditorState,
        escapePressed: true,
      });
    } else if (codeCell.language === 'Import') {
      pixiAppSettings.snackbar('Cannot create code cell inside table', { severity: 'error' });
    } else {
      // if the code editor is not already open on the same cell, then open it
      // this will also open the save changes modal if there are unsaved changes
      setCodeEditorState({
        ...codeEditorState,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
          delaySeconds: 0,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: codeCell.x, y: codeCell.y },
            language: codeCell.language,
            lastModified: Number(codeCell.last_modified),
          },
          showCellTypeMenu: false,
          initialCode: '',
        },
      });
    }
  } else if (codeEditorState.showCodeEditor) {
    // code editor is already open, so check it for save before closing
    setCodeEditorState({
      ...codeEditorState,
      aiAssistant: {
        abortController: undefined,
        loading: false,
        id: '',
        messages: [],
        waitingOnMessageIndex: undefined,
        delaySeconds: 0,
      },
      diffEditorContent: undefined,
      waitingForEditorClose: {
        codeCell: {
          sheetId: sheets.current,
          pos: { x, y },
          language: 'Python',
          lastModified: 0,
        },
        showCellTypeMenu: true,
        initialCode: '',
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
      aiAssistant: {
        abortController: undefined,
        loading: false,
        id: '',
        messages: [],
        waitingOnMessageIndex: undefined,
        delaySeconds: 0,
      },
      diffEditorContent: undefined,
      initialCode: '',
      codeCell: {
        sheetId: sheets.current,
        pos: { x, y },
        language: codeEditorState.codeCell.language,
        lastModified: 0,
      },
    });
  }
};
