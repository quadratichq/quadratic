import { Type } from '@/components/Type';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import { Input } from '@/shadcn/ui/input';
import { Skeleton } from '@/shadcn/ui/skeleton';
import { Cross2Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { useFetcher, useSearchParams } from 'react-router-dom';
import { ApiTypes } from '../../../api/types';
import { ROUTES } from '../../../constants/routes';
import { connections as connectionsById } from './AddConnection';

export const ConnectionsList = () => {
  const fetcher = useFetcher<ApiTypes['/v0/connections.GET.response']>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterQuery, setFilterQuery] = useState<string>('');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Data connections</DialogTitle>
          <DialogDescription>Manage all database and other data connections.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(connectionsById).map(([id, value]) => (
              <Button
                key={id}
                variant="outline"
                className="group relative h-auto"
                onClick={() => {
                  setSearchParams((prev) => {
                    prev.set('connections', `add-${id}`);
                    return searchParams;
                  });
                }}
              >
                <PlusIcon className="absolute right-2 top-2 opacity-30 group-hover:opacity-100" />
                <img src={value.logoFullUrl} alt={value.name + ' logo'} className="max-h-[40px] max-w-[140px]" />
              </Button>
            ))}
          </div>

          <form className="grid gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connections"
                className="pl-8"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
              {filterQuery.length > 0 && (
                <Button
                  variant="link"
                  aria-label="Clear"
                  onClick={() => setFilterQuery('')}
                  className="group absolute right-0 top-0"
                >
                  <Cross2Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </Button>
              )}
            </div>
            {fetcher.state !== 'idle' && <Skeleton className="h-4 w-full" />}
          </form>
          {filterQuery.length > 0 ? (
            <Type className="py-4 text-center">No matches.</Type>
          ) : (
            <Type className="py-4 text-center">You don’t have any connections yet. Add one above.</Type>
          )}
          {/* {fetcher.data && <ConnectionsListComponent connections={fetcher.data} />} */}
        </div>
      </DialogContent>
    </Dialog>
  );
};
