import { codeEditorShowSaveChangesAlertAtom, codeEditorUnsavedChangesAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateEditorEscapePressedAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CodeEditorEscapeEffect = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const editorEscapePressed = useRecoilValue(editorInteractionStateEditorEscapePressedAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  // handle when escape is pressed when escape does not have focus
  useEffect(() => {
    if (editorEscapePressed) {
      if (unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        closeEditor(true);
      }
    }
  }, [closeEditor, editorEscapePressed, setShowSaveChangesAlert, unsavedChanges]);

  return null;
};
