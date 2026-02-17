import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { EmptyState } from '@/shared/components/EmptyState';
import { CloseIcon, EditIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import type {
  ConnectionsListConnection,
  NavigateToView,
  OnConnectionSelectedCallback,
} from '@/shared/components/connections/Connections';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { timeAgo } from '@/shared/utils/timeAgo';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useLocation } from 'react-router';

type Props = {
  connections: ConnectionsListConnection[];
  teamUuid: string;
  connectionsAreLoading?: boolean;
  handleNavigateToEditView: NavigateToView;
  handleShowConnectionDemo: (showConnectionDemo: boolean) => void;
  handleNavigateToNewView: () => void;
  /** Called when an existing connection is selected from the list (in-app only) */
  onConnectionSelected?: OnConnectionSelectedCallback;
};

export const ConnectionsList = ({
  connections,
  connectionsAreLoading,
  teamUuid,
  handleNavigateToNewView,
  handleNavigateToEditView,
  handleShowConnectionDemo,
  onConnectionSelected,
}: Props) => {
  const [filterQuery, setFilterQuery] = useState<string>('');

  return (
    <>
      <div className="grid gap-4">
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
          <Button onClick={handleNavigateToNewView}>New connection</Button>
        </div>
        {connectionsAreLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[20px] w-full rounded" />
            <Skeleton className="h-[20px] w-full rounded" />
          </div>
        )}

        {!connectionsAreLoading && connections.length ? (
          <ListItems
            filterQuery={filterQuery}
            items={connections}
            teamUuid={teamUuid}
            handleNavigateToEditView={handleNavigateToEditView}
            handleShowConnectionDemo={handleShowConnectionDemo}
            onConnectionSelected={onConnectionSelected}
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
  filterQuery,
  handleNavigateToEditView,
  handleShowConnectionDemo,
  items,
  teamUuid,
  onConnectionSelected,
}: {
  filterQuery: string;
  handleNavigateToEditView: Props['handleNavigateToEditView'];
  handleShowConnectionDemo: Props['handleShowConnectionDemo'];
  items: ConnectionsListConnection[];
  teamUuid: string;
  onConnectionSelected?: Props['onConnectionSelected'];
}) {
  const confirmFn = useConfirmDialog('deleteDemoConnection', undefined);

  const filteredItems = filterQuery
    ? items.filter(({ name, type }) => name.toLowerCase().includes(filterQuery.toLowerCase()))
    : items;
  const location = useLocation();
  const isApp = location.pathname.startsWith('/file/');

  return filteredItems.length > 0 ? (
    <div className="relative -mt-3">
      {filteredItems.map(
        (
          {
            uuid,
            name,
            type,
            createdDate,
            disabled,
            isDemo,
            syncedConnectionUpdatedDate,
            syncedConnectionPercentCompleted,
            syncedConnectionLatestLogStatus,
          },
          i
        ) => {
          const isNavigable = !(disabled || isDemo);
          const showIconHideDemo = !disabled && isDemo;
          // On dashboard, show "Open in spreadsheet" and "Edit connection" buttons
          const showDashboardActions = !isApp && !disabled && !isDemo;
          const syncState = deriveSyncStateFromConnectionList({
            syncedConnectionPercentCompleted,
            syncedConnectionLatestLogStatus,
          });

          return (
            <div className="group" key={uuid}>
              <div
                className={cn(
                  'relative flex w-full items-center gap-1',
                  disabled && 'cursor-not-allowed opacity-50',
                  // Only show hover state in app, not on dashboard
                  isApp && isNavigable && 'group-hover:bg-accent'
                )}
              >
                {isApp ? (
                  // In-app: clickable row - if onConnectionSelected is provided, use it; otherwise edit view
                  <button
                    onClick={() => {
                      if (onConnectionSelected) {
                        onConnectionSelected(uuid, type, name);
                      } else {
                        handleNavigateToEditView({ connectionUuid: uuid, connectionType: type });
                      }
                    }}
                    disabled={!isNavigable}
                    key={uuid}
                    className={cn('flex w-full items-center gap-4 rounded px-1 py-2')}
                  >
                    <div className="flex h-6 w-6 items-center justify-center">
                      <ConnectionIcon type={type} syncState={syncState} />
                    </div>

                    <div className="flex w-full min-w-0 flex-grow flex-col text-left">
                      <span data-testid={`connection-name-${name}`} className="truncate text-sm">
                        {name}
                      </span>

                      {isDemo ? (
                        <span className="text-xs text-muted-foreground">Maintained by the Quadratic team</span>
                      ) : (
                        <time dateTime={createdDate} className="text-xs text-muted-foreground">
                          Created {timeAgo(createdDate)}
                        </time>
                      )}
                    </div>
                  </button>
                ) : (
                  // Dashboard: non-clickable row with action buttons
                  <div className={cn('flex w-full items-center gap-4 rounded px-1 py-2')}>
                    <div className="flex h-6 w-6 items-center justify-center">
                      <ConnectionIcon type={type} syncState={syncState} />
                    </div>

                    <div className="flex w-full min-w-0 flex-grow flex-col text-left">
                      <span data-testid={`connection-name-${name}`} className="truncate text-sm">
                        {name}
                      </span>

                      {isDemo ? (
                        <span className="text-xs text-muted-foreground">Maintained by the Quadratic team</span>
                      ) : (
                        <time dateTime={createdDate} className="text-xs text-muted-foreground">
                          Created {timeAgo(createdDate)}
                        </time>
                      )}
                    </div>

                    {showDashboardActions && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNavigateToEditView({ connectionUuid: uuid, connectionType: type })}
                      >
                        <EditIcon className="mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}

                {showIconHideDemo && (
                  <TooltipPopover label="Remove connection">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 flex items-center gap-1 text-muted-foreground hover:bg-background"
                      onClick={async () => {
                        if (await confirmFn()) {
                          handleShowConnectionDemo(false);
                        }
                      }}
                    >
                      <CloseIcon />
                    </Button>
                  </TooltipPopover>
                )}
              </div>
            </div>
          );
        }
      )}
    </div>
  ) : (
    <Type className="py-2 text-center">No matches.</Type>
  );
}
