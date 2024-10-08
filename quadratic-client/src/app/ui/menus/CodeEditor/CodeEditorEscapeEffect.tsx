import {
  codeEditorEscapePressedAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CodeEditorEscapeEffect = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const escapePressed = useRecoilValue(codeEditorEscapePressedAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  // handle when escape is pressed when escape does not have focus
  useEffect(() => {
    if (escapePressed) {
      if (unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        closeEditor(true);
      }
    }
  }, [closeEditor, escapePressed, setShowSaveChangesAlert, unsavedChanges]);

  return null;
};
