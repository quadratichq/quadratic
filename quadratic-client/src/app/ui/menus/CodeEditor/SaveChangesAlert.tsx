import { codeEditorShowSaveChangesAlertAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useAfterDialogCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useAfterDialogCodeEditor';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

interface SaveChangesAlertProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
}

export const SaveChangesAlert = ({ editorInst }: SaveChangesAlertProps) => {
  const { saveAndRunCell } = useSaveAndRunCell();
  const { afterDialog } = useAfterDialogCodeEditor({
    editorInst,
  });
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
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
    setEditorInteractionState((prev) => ({
      ...prev,
      editorEscapePressed: false,
      waitingForEditorClose: undefined,
    }));
  }, [setEditorInteractionState, setShowSaveChangesAlert]);

  const DialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // focus on dialog when it opens
    if (DialogRef.current) {
      DialogRef.current.focus();
    }

    // focus on grid when dialog closes
    return () => focusGrid();
  }, []);

  if (!showSaveChangesAlert) {
    return null;
  }

  return (
    <Dialog
      ref={DialogRef}
      open={true}
      onClose={onCancel}
      aria-labelledby="save-changes-title"
      aria-describedby="save-changes-description"
      maxWidth="sm"
    >
      <DialogTitle>Do you want to save your code editor changes?</DialogTitle>
      <DialogContent>
        <DialogContentText id="save-changes-description">
          Your changes will be lost if you don’t save and run them.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDiscard} color="error" sx={{ marginRight: 'auto' }}>
          Discard changes
        </Button>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSave} autoFocus>
          Save & run
        </Button>
      </DialogActions>
    </Dialog>
  );
};
