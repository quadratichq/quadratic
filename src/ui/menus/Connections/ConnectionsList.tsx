import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useState } from 'react';
import { AddConnection } from './AddConnection';

export const ConnectionsList = (props: { show: boolean; setShow: (show: boolean) => void }) => {
  const [showAddConnection, setShowAddConnection] = useState(false);

  return (
    <>
      <Dialog open={props.show}>
        <DialogTitle>Data Connections</DialogTitle>
        <DialogContent dividers>
          <Typography gutterBottom>Manage all database and other data connections.</Typography>

          <DialogActions>
            <Button
              autoFocus
              onClick={() =>
                setShowAddConnection((prev) => {
                  return !prev;
                })
              }
            >
              Add Connection
            </Button>
            <Button autoFocus onClick={() => props.setShow(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <AddConnection show={showAddConnection} setShow={setShowAddConnection}></AddConnection>
    </>
  );
};
