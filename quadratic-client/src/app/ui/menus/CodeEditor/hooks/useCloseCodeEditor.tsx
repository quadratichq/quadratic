import {
  codeEditorCellLocationAtom,
  codeEditorCodeStringAtom,
  codeEditorEditorContentAtom,
  codeEditorModifiedEditorContentAtom,
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
  const setCellLocation = useSetRecoilState(codeEditorCellLocationAtom);
  const setCodeString = useSetRecoilState(codeEditorCodeStringAtom);
  const setEditorContent = useSetRecoilState(codeEditorEditorContentAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        setCellLocation(undefined);
        setCodeString(undefined);
        setEditorContent(undefined);
        setModifiedEditorContent(undefined);
        setEditorInteractionState((prev) => {
          return {
            ...prev,
            editorEscapePressed: false,
            showCodeEditor: false,
            initialCode: undefined,
          };
        });
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
        editorInst?.dispose();
      }
    },
    [
      editorInst,
      setCellLocation,
      setCodeString,
      setEditorContent,
      setEditorInteractionState,
      setModifiedEditorContent,
      setShowSaveChangesAlert,
      unsavedChanges,
    ]
  );

  return { closeEditor };
};
