import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyState } from '@/shared/components/EmptyState';
import { AddIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Type } from '@/shared/components/Type';
import type { ConnectionsListConnection } from '@/shared/components/connections/Connections';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

export const ConnectionsList = () => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const {
    activeTeam: { connections },
  } = useDashboardRouteLoaderData();
  const params = useParams();
  const activeConnection = params.connectionUuid;

  return (
    <>
      <div className="flex flex-col gap-2 px-3 pt-3">
        <div className="flex gap-2">
          <form
            className="grid flex-grow gap-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="relative">
              <Input
                placeholder="Filter by name"
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
        </div>

        {connections.length ? (
          <ListItems activeConnection={activeConnection} filterQuery={filterQuery} items={connections} />
        ) : (
          <EmptyState
            title="No connections"
            className={'my-8'}
            description={
              <>
                <p>Create a connection from the options above, then open a spreadsheet and pull in data from it.</p>
                <p className="mt-2">
                  Or,{' '}
                  <button
                    className="relative font-semibold text-primary"
                    onClick={() => {
                      // TODO
                      // handleShowConnectionDemo(true);
                    }}
                  >
                    add a demo connection
                  </button>
                  .
                </p>
              </>
            }
            Icon={ConnectionsIcon}
          />
        )}
      </div>
    </>
  );
};

function ListItems({
  activeConnection,
  filterQuery,
  items,
}: {
  activeConnection?: string;
  filterQuery: string;
  items: ConnectionsListConnection[];
}) {
  const filteredItems = filterQuery
    ? items.filter(({ name, type }) => name.toLowerCase().includes(filterQuery.toLowerCase()))
    : items;
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const activeConnectionUuid = params.connectionUuid;

  return filteredItems.length > 0 ? (
    <div className="relative flex flex-col gap-0.5">
      <Link
        to="./new"
        className={cn(
          'flex h-10 items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent',
          location.pathname.includes('new') && 'bg-accent'
        )}
      >
        <AddIcon className="text-muted-foreground" /> New…
      </Link>
      {filteredItems.map(({ uuid, name, type, createdDate, disabled, isDemo }, i) => {
        const isActive = activeConnectionUuid === uuid;
        return (
          <button
            disabled={isActive}
            onClick={() => {
              navigate(`./${uuid}`, { replace: true });
            }}
            key={uuid}
            className={cn('flex items-center gap-2 rounded px-2 py-2 hover:bg-accent', isActive && 'bg-accent')}
          >
            <div className="flex h-6 w-6 items-center justify-center">
              <LanguageIcon language={type} />
            </div>

            <div className="flex w-full min-w-0 flex-grow flex-row items-center justify-between gap-2">
              <span data-testid={`connection-name-${name}`} className="truncate text-sm">
                {name}
              </span>

              {/* TODO: display the name properly */}
              <span className="text-xs text-muted-foreground">{type.toLowerCase()}</span>
            </div>
          </button>
        );
      })}
    </div>
  ) : (
    <Type className="py-2 text-center">No matches.</Type>
  );
}
