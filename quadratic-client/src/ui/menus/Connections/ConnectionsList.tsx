import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shadcn/ui/dialog';
import { CircularProgress } from '@mui/material';
import { PlusIcon } from '@radix-ui/react-icons';
import { useEffect } from 'react';
import { useFetcher, useSearchParams } from 'react-router-dom';
import { ApiTypes } from '../../../api/types';
import { ROUTES } from '../../../constants/routes';
import { ConnectionsListComponent } from '../../../dashboard/connections/components/ConnectionsListComponent';

export const ConnectionsList = () => {
  const fetcher = useFetcher<ApiTypes['/v0/connections.GET.response']>();
  const [searchParams, setSearchParams] = useSearchParams();
  const connections = searchParams.get('connections');
  const open = connections === 'list';
  const onOpenChange = () => {
    setSearchParams((prev) => {
      prev.delete('connections');
      return searchParams;
    });
  };

  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.CONNECTIONS);
    }
  }, [fetcher]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                setSearchParams((prev) => {
                  prev.set('connections', 'add-postgres');
                  return searchParams;
                });
              }}
            >
              <PlusIcon className="mr-2" /> Add Postgres
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchParams((prev) => {
                  prev.set('connections', 'add-mysql');
                  return searchParams;
                });
              }}
            >
              <PlusIcon className="mr-2" /> Add MySQL
            </Button>
          </div>
          {!fetcher.data && <CircularProgress style={{ width: 18, height: 18 }} />}
          {fetcher.data && <ConnectionsListComponent connections={fetcher.data} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
