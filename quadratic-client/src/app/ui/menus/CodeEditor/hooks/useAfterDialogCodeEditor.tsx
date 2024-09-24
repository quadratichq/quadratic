import { codeEditorShowSaveChangesAlertAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateAtom,
  editorInteractionStateEditorEscapePressedAtom,
  editorInteractionStateWaitingForEditorCloseAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import * as monaco from 'monaco-editor';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const useAfterDialogCodeEditor = ({
  editorInst,
}: {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const editorEscapePressed = useRecoilValue(editorInteractionStateEditorEscapePressedAtom);
  const waitingForEditorClose = useRecoilValue(editorInteractionStateWaitingForEditorCloseAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  const afterDialog = useCallback(() => {
    setShowSaveChangesAlert(false);
    if (editorEscapePressed) {
      closeEditor(true);
    }
    if (waitingForEditorClose) {
      setEditorInteractionState((oldState) => ({
        ...oldState,
        selectedCell: waitingForEditorClose.selectedCell,
        selectedCellSheet: waitingForEditorClose.selectedCellSheet,
        mode: waitingForEditorClose.mode,
        showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
        showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
        initialCode: waitingForEditorClose.initialCode,
        waitingForEditorClose: undefined,
      }));
      if (waitingForEditorClose.inlineEditor) {
        pixiAppSettings.changeInput(true);
      }
    } else {
      closeEditor(true);
    }
  }, [closeEditor, editorEscapePressed, setEditorInteractionState, setShowSaveChangesAlert, waitingForEditorClose]);

  return { afterDialog };
};
