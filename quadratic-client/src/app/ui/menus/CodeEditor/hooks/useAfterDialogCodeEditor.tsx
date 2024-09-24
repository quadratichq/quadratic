import {
  codeEditorAtom,
  codeEditorEscapePressedAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorWaitingForEditorClose,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
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
  const escapePressed = useRecoilValue(codeEditorEscapePressedAtom);
  const waitingForEditorClose = useRecoilValue(codeEditorWaitingForEditorClose);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  const afterDialog = useCallback(() => {
    setShowSaveChangesAlert(false);
    if (escapePressed) {
      closeEditor(true);
    }
    if (waitingForEditorClose) {
      setShowCellTypeMenu(waitingForEditorClose.showCellTypeMenu);
      setCodeEditorState((prev) => ({
        ...prev,
        showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
        codeCell: waitingForEditorClose.codeCell,
        initialCode: waitingForEditorClose.initialCode,
        waitingForEditorClose: undefined,
      }));
      if (waitingForEditorClose.inlineEditor) {
        pixiAppSettings.changeInput(true);
      }
    } else {
      closeEditor(true);
    }
  }, [
    closeEditor,
    escapePressed,
    setCodeEditorState,
    setShowCellTypeMenu,
    setShowSaveChangesAlert,
    waitingForEditorClose,
  ]);

  return { afterDialog };
};
