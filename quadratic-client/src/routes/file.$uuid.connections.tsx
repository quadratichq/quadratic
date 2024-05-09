import { focusGrid } from '@/app/helpers/focusGrid';
import { colors } from '@/app/theme/colors';
import { ConnectionsBreadcrumb } from '@/app/ui/connections/ConnectionsBreadcrumb';
import { connectionsByType } from '@/app/ui/connections/data';
import { PostgresIcon } from '@/app/ui/icons';
import { useFileMetaRouteLoaderData } from '@/routes/_file.$uuid';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { timeAgo } from '@/shared/utils/timeAgo';
import { Cross2Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';

export const Component = () => {
  const { uuid } = useParams() as { uuid: string };
  const navigate = useNavigate();

  const onClose = () => {
    navigate(ROUTES.FILE(uuid), { replace: true });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent onCloseAutoFocus={focusGrid}>
        <Outlet />
      </DialogContent>
    </Dialog>
  );
};

export const Index = () => {
  const { uuid } = useParams() as { uuid: string };
  const navigate = useNavigate();
  const [filterQuery, setFilterQuery] = useState<string>('');
  const { connections } = useFileMetaRouteLoaderData();

  const filteredConnections =
    filterQuery.length > 0
      ? connections.filter(({ name, type }) => name.toLowerCase().includes(filterQuery.toLowerCase()))
      : connections;

  return (
    <>
      <DialogHeader>
        <ConnectionsBreadcrumb />
        <DialogTitle>My connections</DialogTitle>
        <DialogDescription>Connetions let you pull outside data into your spreadsheets</DialogDescription>
      </DialogHeader>
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-6">
          {Object.entries(connectionsByType).map(([type, { Logo }], i) => (
            <Button
              key={type}
              variant="outline"
              className="group relative h-auto w-full"
              onClick={() => {
                navigate(ROUTES.FILE_CONNECTIONS_CREATE(uuid, type.toLowerCase()));
              }}
            >
              <PlusIcon className="absolute bottom-2 right-2 opacity-30 group-hover:opacity-100" />
              <Logo className="h-[40px] w-[160px]" />
            </Button>
          ))}
        </div>

        {connections.length > 0 && (
          <>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search connections"
                  className="pl-8"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  autoFocus
                />
                {filterQuery.length > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    aria-label="Clear"
                    onClick={() => setFilterQuery('')}
                    className="group absolute right-0 top-0"
                  >
                    <Cross2Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </Button>
                )}
              </div>
            </form>
            {filteredConnections.length > 0 ? (
              <div className="-mt-4">
                {filteredConnections.map(({ uuid: connectionUuid, name, type, updatedDate }, i) => (
                  <Link
                    to={ROUTES.FILE_CONNECTION(uuid, connectionUuid)}
                    key={connectionUuid}
                    className={cn(
                      `flex items-center gap-4 px-1 py-2 hover:bg-accent`,
                      i < filteredConnections.length - 1 && 'border-b border-border'
                    )}
                  >
                    <PostgresIcon style={{ color: colors.languagePostgres }} fontSize="small" />
                    <div className="flex flex-grow items-center justify-between">
                      <span className="text-sm">{name}</span>
                      <time dateTime={updatedDate} className="text-xs text-muted-foreground">
                        Updated {timeAgo(updatedDate)}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Type className="py-2 text-center">No matches.</Type>
            )}
          </>
        )}
      </div>
    </>
  );
};

// TODO: (connections) make some nice error boundary routes for the dialog.
// If the data failed to load, show something useful.
