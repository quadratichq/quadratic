import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { ApiTypes } from '../../../api/types';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { ROUTES } from '../../../constants/routes';
import { ConnectionsListComponent } from '../../../dashboard/connections/components/ConnectionsListComponent';
import { AddConnection } from './AddConnection';

export const ConnectionsList = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const fetcher = useFetcher<ApiTypes['/v0/connections.GET.response']>();

  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.CONNECTIONS);
    }
  }, [fetcher]);

  return (
    <>
      <Dialog open={true}>
        <DialogTitle>Data Connections</DialogTitle>
        <DialogContent dividers>
          <Typography gutterBottom>Manage all database and other data connections.</Typography>

          {fetcher.data ? (
            <ConnectionsListComponent connections={fetcher.data} />
          ) : (
            <Typography gutterBottom>Loading...</Typography>
          )}

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
            <Button
              autoFocus
              onClick={() =>
                setEditorInteractionState((state) => {
                  return {
                    ...state,
                    showConnectionsMenu: false,
                  };
                })
              }
            >
              Close
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <AddConnection show={showAddConnection} setShow={setShowAddConnection}></AddConnection>
    </>
  );
};
