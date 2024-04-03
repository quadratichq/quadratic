import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shadcn/ui/dialog';
import { CircularProgress } from '@mui/material';
import { PlusIcon } from '@radix-ui/react-icons';
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

  const closeDialog = () => {
    setEditorInteractionState((state) => {
      return {
        ...state,
        showConnectionsMenu: false,
      };
    });
  };

  const close2ndDialog = () => {
    setShowAddConnection(false);
    closeDialog();
  };

  return (
    <>
      {!showAddConnection ? (
        <Dialog open={true} onOpenChange={closeDialog}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Data connections</DialogTitle>
              <DialogDescription>Manage all database and other data connections.</DialogDescription>
            </DialogHeader>
            <div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddConnection(true);
                  }}
                >
                  <PlusIcon className="mr-2" /> Add connection
                </Button>
                {!fetcher.data && <CircularProgress style={{ width: 18, height: 18 }} />}
              </div>
              {fetcher.data && <ConnectionsListComponent connections={fetcher.data} />}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <AddConnection onClose={close2ndDialog}></AddConnection>
      )}
    </>
  );
};
