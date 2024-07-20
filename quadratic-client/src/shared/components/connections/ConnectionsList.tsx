import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { Empty } from '@/dashboard/components/Empty';
import { Type } from '@/shared/components/Type';
import {
  ConnectionsListConnection,
  NavigateToCreateView,
  NavigateToEditView,
} from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { timeAgo } from '@/shared/utils/timeAgo';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';

type Props = {
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
  handleNavigateToCreateView: NavigateToCreateView;
  handleNavigateToEditView: NavigateToEditView;
};

export const ConnectionsList = ({
  connections,
  connectionsAreLoading,
  handleNavigateToCreateView,
  handleNavigateToEditView,
}: Props) => {
  const [filterQuery, setFilterQuery] = useState<string>('');

  return (
    <>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(connectionsByType).map(([type, { Logo }], i) => (
            <Button
              key={type}
              variant="outline"
              className="group relative h-auto w-full"
              onClick={() => {
                handleNavigateToCreateView(type as ConnectionType);
              }}
            >
              <PlusIcon className="absolute bottom-2 right-2 opacity-30 group-hover:opacity-100" />
              <Logo className="h-[40px] w-[160px]" />
            </Button>
          ))}
        </div>

        {connectionsAreLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[20px] w-full rounded" />
            <Skeleton className="h-[20px] w-full rounded" />
          </div>
        )}

        {!connectionsAreLoading && connections.length ? (
          <>
            <form
              className="grid gap-4"
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
            <ListItems
              filterQuery={filterQuery}
              items={connections}
              handleNavigateToEditView={handleNavigateToEditView}
            />
          </>
        ) : (
          <Empty
            title="No connections"
            description="Create a connection from the options above, then open a spreadsheet and pull in data from it."
            Icon={ConnectionsIcon}
          />
        )}
      </div>
    </>
  );
};

function ListItems({
  filterQuery,
  handleNavigateToEditView,
  items,
}: {
  filterQuery: string;
  handleNavigateToEditView: Props['handleNavigateToEditView'];
  items: ConnectionsListConnection[];
}) {
  const filteredItems = filterQuery
    ? items.filter(({ name, type }) => name.toLowerCase().includes(filterQuery.toLowerCase()))
    : items;

  return filteredItems.length > 0 ? (
    <div className="-mt-3">
      {filteredItems.map(({ uuid, name, type, createdDate, disabled }, i) => (
        <button
          onClick={() => {
            handleNavigateToEditView({ connectionUuid: uuid, connectionType: type });
          }}
          disabled={disabled}
          key={uuid}
          className={cn(
            `flex w-full items-center gap-2 px-1 py-2`,
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent'
            // i < filteredConnections.length - 1 && 'border-b border-border'
          )}
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <LanguageIcon language={type} fontSize="small" />
          </div>
          <div className="flex flex-grow items-center justify-between">
            <span className="text-sm">{name}</span>
            <time dateTime={createdDate} className="text-xs text-muted-foreground">
              Created {timeAgo(createdDate)}
            </time>
          </div>
        </button>
      ))}
    </div>
  ) : (
    <Type className="py-2 text-center">No matches.</Type>
  );
}
