import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useEffect, useRef } from 'react';
import { focusGrid } from '../../../helpers/focusGrid';

interface Props {
  onCancel: (e: React.SyntheticEvent) => void;
  onSave: (e: React.SyntheticEvent) => void;
  onDiscard: (e: React.SyntheticEvent) => void;
}

export const SaveChangesAlert = (props: Props) => {
  const { onCancel, onSave, onDiscard } = props;

  const DialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // focus on dialog when it opens
    if (DialogRef.current) {
      DialogRef.current.focus();
    }

    // focus on grid when dialog closes
    return () => focusGrid();
  }, []);

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
