import {
  codeEditorCodeStringAtom,
  codeEditorEditorContentAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import * as monaco from 'monaco-editor';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const useCloseCodeEditor = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const setCodeString = useSetRecoilState(codeEditorCodeStringAtom);
  const setEditorContent = useSetRecoilState(codeEditorEditorContentAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        setCodeString(undefined);
        setEditorContent(undefined);
        setEditorInteractionState((prev) => ({
          ...prev,
          editorEscapePressed: false,
          showCodeEditor: false,
          initialCode: undefined,
        }));
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
        editorInst?.dispose();
      }
    },
    [editorInst, setCodeString, setEditorContent, setEditorInteractionState, setShowSaveChangesAlert, unsavedChanges]
  );

  return { closeEditor };
};
