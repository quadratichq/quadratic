import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { EmptyState } from '@/shared/components/EmptyState';
import { AddIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Type } from '@/shared/components/Type';
import type {
  ConnectionsListConnection,
  NavigateToCreateView,
  NavigateToView,
} from '@/shared/components/connections/Connections';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { timeAgo } from '@/shared/utils/timeAgo';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useLocation } from 'react-router';

type Props = {
  activeConnection?: string;
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
  handleNavigateToCreateView: NavigateToCreateView;
  handleNavigateToDetailsView: NavigateToView;
  handleNavigateToEditView: NavigateToView;
  handleNavigateToListView: () => void;
  handleShowConnectionDemo: (showConnectionDemo: boolean) => void;
  handleNavigateToNewView: () => void;
};

export const ConnectionsList = ({
  activeConnection,
  connections,
  connectionsAreLoading,
  handleNavigateToNewView,
  handleNavigateToCreateView,
  handleNavigateToDetailsView,
  handleNavigateToEditView,
  handleNavigateToListView,
  handleShowConnectionDemo,
}: Props) => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  console.log(activeConnection);
  return (
    <>
      <div className="flex flex-col gap-2">
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
        {connectionsAreLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[20px] w-full rounded" />
            <Skeleton className="h-[20px] w-full rounded" />
          </div>
        )}

        <div
          onClick={handleNavigateToNewView}
          className={cn(
            'flex h-10 items-center gap-2 text-sm text-primary hover:bg-accent',
            activeConnection === 'new' && 'bg-accent'
          )}
        >
          <AddIcon className="ml-1 mr-2" /> New
        </div>
        {!connectionsAreLoading && connections.length ? (
          <ListItems
            handleNavigateToListView={handleNavigateToListView}
            activeConnection={activeConnection}
            filterQuery={filterQuery}
            items={connections}
            handleNavigateToDetailsView={handleNavigateToDetailsView}
            handleNavigateToEditView={handleNavigateToEditView}
            handleShowConnectionDemo={handleShowConnectionDemo}
          />
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
                      handleShowConnectionDemo(true);
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
  handleNavigateToDetailsView,
  handleNavigateToEditView,
  handleShowConnectionDemo,
  handleNavigateToListView,
  items,
}: {
  activeConnection?: string;
  filterQuery: string;
  handleNavigateToDetailsView: Props['handleNavigateToDetailsView'];
  handleNavigateToEditView: Props['handleNavigateToEditView'];
  handleShowConnectionDemo: Props['handleShowConnectionDemo'];
  handleNavigateToListView: Props['handleNavigateToListView'];
  items: ConnectionsListConnection[];
}) {
  const filteredItems = filterQuery
    ? items.filter(({ name, type }) => name.toLowerCase().includes(filterQuery.toLowerCase()))
    : items;
  const location = useLocation();
  const isApp = location.pathname.startsWith('/file/');

  return filteredItems.length > 0 ? (
    <div className="relative -mt-3">
      {filteredItems.map(({ uuid, name, type, createdDate, disabled, isDemo }, i) => {
        const isNavigable = !(disabled || isDemo);
        const showSecondaryAction = !isApp && !disabled;

        return (
          <div className={cn('group', activeConnection === uuid && 'bg-accent')} key={uuid}>
            <div
              className={cn(
                'relative flex w-full items-center gap-1',
                disabled && 'cursor-not-allowed opacity-50',
                isNavigable && 'group-hover:bg-accent',
                showSecondaryAction && 'pr-12'
              )}
            >
              <button
                onClick={() => {
                  if (activeConnection === uuid) {
                    handleNavigateToListView();
                  } else {
                    handleNavigateToDetailsView({ connectionUuid: uuid, connectionType: type });
                  }
                  // handleNavigateToEditView({ connectionUuid: uuid, connectionType: type });
                }}
                disabled={!isNavigable}
                key={uuid}
                className={cn('flex w-full items-center gap-4 rounded px-1 py-2')}
              >
                <div className="flex h-6 w-6 items-center justify-center">
                  <LanguageIcon language={type} />
                </div>

                <div className="flex w-full min-w-0 flex-grow flex-col text-left">
                  <span data-testid={`connection-name-${name}`} className="truncate text-sm">
                    {name}
                  </span>

                  {isDemo ? (
                    <span className="hidden text-xs text-muted-foreground">Maintained by the Quadratic team</span>
                  ) : (
                    <time dateTime={createdDate} className="hidden text-xs text-muted-foreground">
                      Created {timeAgo(createdDate)}
                    </time>
                  )}
                </div>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <Type className="py-2 text-center">No matches.</Type>
  );
}
