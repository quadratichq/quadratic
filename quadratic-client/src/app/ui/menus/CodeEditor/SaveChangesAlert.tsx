import { codeEditorAtom, codeEditorShowSaveChangesAlertAtom } from '@/app/atoms/codeEditorAtom';
import { useAfterDialogCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useAfterDialogCodeEditor';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/shadcn/ui/alert-dialog';
import type * as monaco from 'monaco-editor';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

interface SaveChangesAlertProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}

export const SaveChangesAlert = ({ editorInst }: SaveChangesAlertProps) => {
  const { saveAndRunCell } = useSaveAndRunCell();
  const { afterDialog } = useAfterDialogCodeEditor({
    editorInst,
  });
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useRecoilState(codeEditorShowSaveChangesAlertAtom);

  const onDiscard = useCallback(() => {
    afterDialog();
  }, [afterDialog]);

  const onSave = useCallback(() => {
    saveAndRunCell();
    afterDialog();
  }, [afterDialog, saveAndRunCell]);

  const onCancel = useCallback(() => {
    setShowSaveChangesAlert(false);
    setCodeEditorState((prev) => ({
      ...prev,
      escapePressed: false,
      waitingForEditorClose: undefined,
    }));
    // Return focus to the code editor instead of the grid
    requestAnimationFrame(() => editorInst?.focus());
  }, [setCodeEditorState, setShowSaveChangesAlert, editorInst]);

  if (!showSaveChangesAlert) {
    return null;
  }
  
  return (
    <AlertDialog
      open={true}
      onOpenChange={onCancel}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Do you want to save your code changes?</AlertDialogTitle>
          <AlertDialogDescription>
              Any unsaved changes will be lost if you don’t save and run them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="outline-destructive" onClick={onDiscard} className="mr-auto">Discard changes</AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSave}>Save & run</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
