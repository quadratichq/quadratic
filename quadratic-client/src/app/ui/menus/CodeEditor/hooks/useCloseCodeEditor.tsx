import {
  codeEditorShowCodeEditorAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import * as monaco from 'monaco-editor';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const useCloseCodeEditor = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const setShowCodeEditor = useSetRecoilState(codeEditorShowCodeEditorAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        setShowCodeEditor(false);
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
        editorInst?.dispose();
      }
    },
    [editorInst, setShowCodeEditor, setShowSaveChangesAlert, unsavedChanges]
  );

  return { closeEditor };
};
