import { Button, Dialog, DialogActions, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import './NewFile.css';

interface Props {
  open: boolean;
  handleClose: (filename?: string) => void;
}

export const NewFile = (props: Props): JSX.Element => {
  const [filename, setFilename] = useState('');

  return (
    <Dialog open={props.open} onClose={() => props.handleClose()}>
      <div className="dialogNewFile">
        <DialogTitle>Create Grid File</DialogTitle>
        <TextField
          autoFocus
          size="small"
          margin="dense"
          id="grid-name"
          label="Filename"
          type="filename"
          fullWidth
          variant="standard"
          onChange={(event) => setFilename(event.target.value)}
          onKeyPress={(event) => {
            if (event.key === 'Enter') {
              props.handleClose(filename);
            }
          }}
        />
        <DialogActions>
          <Button onClick={() => props.handleClose()}>Cancel</Button>
          <Button onClick={() => props.handleClose(filename)}>Create</Button>
        </DialogActions>
      </div>
    </Dialog>
  );
};
