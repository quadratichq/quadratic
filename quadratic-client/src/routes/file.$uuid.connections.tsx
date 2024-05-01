import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { Cross2Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const connectionsById = {
  postgres: {
    name: 'Postgres',
    logoFullUrl: '/images/connections-logo-postgresql.png',
    id: 'postgres',
    // logoIconUrl: ''
    // Component: ConnectionFormFieldsPostgres,
  },
  mysql: {
    name: 'MySQL',
    logoFullUrl: '/images/connections-logo-mysql.png',
    id: 'mysql',
    // logoIconUrl: ''
    // Component: () => {},
  },
};

export const Component = () => {
  const { uuid } = useParams() as { uuid: string };
  const navigate = useNavigate();
  const [filterQuery, setFilterQuery] = useState<string>('');

  const onClose = () => {
    navigate(ROUTES.FILE(uuid));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
          <DialogDescription>Manage your connections to outside data sources</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(connectionsById).map(([id, connection]) => (
              <Button
                key={id}
                variant="outline"
                className="group relative h-auto"
                onClick={() => {
                  // setSearchParams((prev) => {
                  //   prev.set(connection.searchParamKey, connection.searchParamValue);
                  //   return searchParams;
                  // });
                  navigate(ROUTES.FILE_CONNECTIONS_CREATE(uuid, connection.id));
                }}
              >
                <PlusIcon className="absolute right-2 top-2 opacity-30 group-hover:opacity-100" />
                <img
                  src={connection.logoFullUrl}
                  alt={connection.name + ' logo'}
                  className="max-h-[40px] max-w-[140px]"
                />
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
            {false && <Skeleton className="h-4 w-full" />}
          </form>
          {filterQuery.length > 0 ? (
            <Type className="py-4 text-center">No matches.</Type>
          ) : (
            <Type className="py-4 text-center">You don’t have any connections yet. Add one above.</Type>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// TODO: (connections) make some nice error boundary routes for the dialog
