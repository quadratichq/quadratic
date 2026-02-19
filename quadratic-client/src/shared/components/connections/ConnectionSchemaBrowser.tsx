import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { SyncedConnectionStatusMinimal } from '@/shared/components/connections/SyncedConnection';
import {
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  MoreHorizIcon,
  RefreshIcon,
  type IconComponent,
} from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSyncedConnectionType, type ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useSetRecoilState } from 'recoil';

type SchemaBrowserTableAction = {
  label: string;
  onClick: (args: { table: Table; tableQuery: string }) => void;
  Icon: IconComponent;
};
export type SchemaBrowserTableActionOnClick = Parameters<SchemaBrowserTableAction['onClick']>[0];

type ConnectionSchemaBrowserProps = {
  eventSource: string;
  teamUuid: string;
  type: ConnectionType;
  additionalActions?: React.ReactNode;
  hideRefreshButton?: boolean;
  tableActions?: Array<SchemaBrowserTableAction>;
  uuid?: string;
};

export const ConnectionSchemaBrowser = ({
  additionalActions,
  hideRefreshButton = false,
  tableActions,
  eventSource,
  teamUuid,
  type,
  uuid,
}: ConnectionSchemaBrowserProps) => {
  const isSynced = isSyncedConnectionType(type);
  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({ type, uuid, teamUuid });
  const { connections } = useConnectionsFetcher();
  const connection = useMemo(
    () => (isSynced && uuid ? connections.find((c) => c.uuid === uuid) : undefined),
    [isSynced, uuid, connections]
  );
  const syncState = connection ? (deriveSyncStateFromConnectionList(connection) ?? null) : null;

  const [filterQuery, setFilterQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const disabled = isLoading || data === undefined;
  const filteredTables = useMemo(() => {
    if (!data) return [];
    const query = filterQuery.trim().toLowerCase();
    if (!query) return data.tables;
    return data.tables.filter(
      (table) => table.name.toLowerCase().includes(query) || table.schema.toLowerCase().includes(query)
    );
  }, [data, filterQuery]);

  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  const handleReload = useCallback(() => {
    trackEvent('[ConnectionSchemaBrowser].refresh', { eventSource });
    reloadSchema();
  }, [eventSource, reloadSchema]);

  if (type === undefined || uuid === undefined) return null;

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="h-full overflow-auto text-sm">
      <div className="sticky top-0 z-10 mb-1.5 flex flex-col gap-1 bg-background px-2">
        <div className="flex h-10 items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            {data && data.type ? (
              <>
                <div className="flex h-6 w-6 flex-shrink-0 items-center">
                  <ConnectionIcon type={data.type} syncState={syncState} />
                </div>
                <div className="flex flex-col gap-0">
                  <h3 className="truncate font-medium leading-4 tracking-tight">{data.name}</h3>
                  {isSynced && uuid && syncState && (
                    <button
                      onClick={() => setShowConnectionsMenu({ connectionUuid: uuid, connectionType: type })}
                      className="flex items-center text-xs text-muted-foreground hover:underline"
                    >
                      <SyncedConnectionStatusMinimal
                        syncState={syncState}
                        updatedDate={connection?.syncedConnectionUpdatedDate}
                      />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </div>

          <div className="flex flex-row-reverse items-center gap-1">
            {additionalActions}
            {!hideRefreshButton && (
              <TooltipPopover label="Reload schema">
                <Button onClick={handleReload} variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <RefreshIcon className={cn(isLoading && 'animate-spin')} />
                </Button>
              </TooltipPopover>
            )}
          </div>
        </div>

        <div className="relative">
          <Input
            ref={inputRef}
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value);
            }}
            placeholder="Filter tables"
            className="h-8"
            disabled={disabled}
          />
          {filterQuery && (
            <Button
              disabled={disabled}
              variant="ghost"
              size="icon-sm"
              className="absolute right-0 top-0 h-8 w-8 !bg-transparent text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilterQuery('');
                inputRef.current?.focus();
              }}
            >
              <CloseIcon />
            </Button>
          )}
        </div>
      </div>

      {isLoading && data === undefined && (
        <div className="mb-4 flex min-h-16 items-center justify-center text-muted-foreground">Loading…</div>
      )}

      {data &&
        filteredTables.map((table, index) => (
          <TableListItem
            index={index}
            data={table}
            key={index}
            connectionType={type}
            tableActions={tableActions}
            eventSource={eventSource}
          />
        ))}
      {data === null && (
        <div className="mx-auto my-2 flex max-w-md flex-col items-center justify-center gap-2 pb-4 text-center text-sm text-muted-foreground">
          <h4 className="font-semibold text-destructive">Error loading connection schema</h4>
          <p>
            Try to{' '}
            <button className="underline hover:text-primary" onClick={reloadSchema}>
              reload the schema
            </button>
            . If that doesn’t work,{' '}
            <Link
              to={ROUTES.TEAM_CONNECTION(teamUuid, uuid, type)}
              // This has to be hard-reload because we don't use URLs and we don't know the context:
              // of whether this is in the app or in the dashboard
              reloadDocument={true}
              className="underline hover:text-primary"
            >
              view the connection details
            </Link>{' '}
            and ensure it’s properly configured.
          </p>
          <p>
            If you still have problems,{' '}
            <Link to={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
              contact us
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
};

type Table = {
  name: string;
  schema: string;
  columns: Column[];
};

type Column = {
  is_nullable: boolean;
  name: string;
  type: string;
};

function TableListItem({
  index,
  data,
  connectionType,
  tableActions,
  eventSource,
}: {
  index: number;
  data: Table;
  connectionType: ConnectionType;
  tableActions: ConnectionSchemaBrowserProps['tableActions'];
  eventSource: string;
}) {
  const { name, columns } = data;
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTableClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      trackEvent('[ConnectionSchemaBrowser].clickTable', { eventSource });
      setIsExpanded((prev) => !prev);
    },
    [eventSource]
  );

  const handleDropdownClick = useCallback(() => {
    trackEvent('[ConnectionSchemaBrowser].clickDropdown', { eventSource });
  }, [eventSource]);

  const handleDropdownMenuItemClick = useCallback(
    ({
      label,
      onClick,
    }: {
      label: string;
      onClick: NonNullable<ConnectionSchemaBrowserProps['tableActions']>[number]['onClick'];
    }) => {
      trackEvent('[ConnectionSchemaBrowser].clickDropdownItem', { eventSource, label });
      onClick({
        table: data,
        tableQuery: getTableQuery({ table: data, connectionType }),
      });
    },
    [eventSource, data, connectionType]
  );

  return (
    <div className="group relative">
      <button
        className={cn(
          'flex h-7 w-full min-w-0 flex-initial cursor-default select-text items-center pl-2 font-normal hover:bg-accent',
          tableActions ? 'pr-10' : 'pr-3'
        )}
        onClick={handleTableClick}
      >
        <div className="-ml-0.5 flex h-6 w-6 flex-none items-center">
          <ChevronRightIcon className={cn('text-muted-foreground', isExpanded && 'rotate-90')} />
        </div>
        <div className="truncate leading-normal">{name}</div>
        <div className="ml-auto flex flex-none items-center text-xs text-muted-foreground">{columns.length} cols</div>
      </button>
      {tableActions && (
        <div className="absolute right-2 top-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={handleDropdownClick}>
                <MoreHorizIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {tableActions.map(({ label, onClick, Icon }) => (
                <DropdownMenuItem key={label} onClick={() => handleDropdownMenuItemClick({ label, onClick })}>
                  <Icon className="mr-2" /> {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isExpanded && (
        <ul className={cn('pl-8 pr-2')}>
          {columns.length ? (
            columns.map(({ name, type, is_nullable }, k) => (
              <li key={k} className="border border-l border-transparent border-l-border pl-0.5">
                <div className="flex w-full items-center justify-between gap-1 py-0.5 pl-2">
                  <div className="truncate">{name}</div>

                  <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    {type}
                    {is_nullable && '?'}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <div className="border border-l border-transparent border-l-border pl-3">
              <Type className="font-mono text-sm italic text-muted-foreground">[No columns]</Type>
            </div>
          )}
        </ul>
      )}
    </div>
  );
}

export const SCHEMA_BROWSER_TABLE_ACTIONS: Record<string, SchemaBrowserTableAction> = {
  COPY_NAME: {
    label: 'Copy name',
    Icon: CopyIcon,
    onClick: ({ tableQuery }) => {
      navigator.clipboard.writeText(tableQuery);
    },
  },
  COPY_QUERY: {
    label: 'Copy query',
    Icon: CopyIcon,
    onClick: ({ tableQuery }) => {
      navigator.clipboard.writeText(tableQuery);
    },
  },
} as const;

function getTableQuery({ table: { name, schema }, connectionType }: { table: Table; connectionType: ConnectionType }) {
  switch (connectionType) {
    case 'POSTGRES':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'COCKROACHDB':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'SUPABASE':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'NEON':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'MYSQL':
      return `SELECT * FROM \`${schema}\`.\`${name}\` LIMIT 100`;
    case 'MARIADB':
      return `SELECT * FROM \`${schema}\`.\`${name}\` LIMIT 100`;
    case 'MSSQL':
      return `SELECT TOP 100 * FROM [${schema}].[${name}]`;
    case 'SNOWFLAKE':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'BIGQUERY':
      return `SELECT * FROM \`${schema}\`.\`${name}\` LIMIT 100`;

    // datafusion connections
    case 'MIXPANEL':
    case 'GOOGLE_ANALYTICS':
    case 'PLAID':
      return `SELECT * FROM \`${name}\` LIMIT 100`;
    default:
      return '';
  }
}
