import {
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  MoreHorizIcon,
  RefreshIcon,
  type IconComponent,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';

type ConnectionSchemaBrowserProps = {
  eventSource: string;
  teamUuid: string;
  type: ConnectionType;
  additionalActions?: React.ReactNode;
  additionalDropdownItems?: Array<{
    label: string;
    onClick: (args: { tableQuery: string; tableName: string }) => void;
    Icon: IconComponent;
  }>;
  uuid?: string;
};

export const ConnectionSchemaBrowser = ({
  additionalActions,
  additionalDropdownItems,
  eventSource,
  teamUuid,
  type,
  uuid,
}: ConnectionSchemaBrowserProps) => {
  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({ type, uuid, teamUuid });

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

  const handleReload = useCallback(() => {
    trackEvent('[ConnectionSchemaBrowser].refresh', { eventSource });
    reloadSchema();
  }, [eventSource, reloadSchema]);

  if (type === undefined || uuid === undefined) return null;

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="h-full overflow-auto text-sm">
      <div className="sticky top-0 z-10 mb-1.5 flex flex-col gap-1 bg-background px-2 pt-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            {data && data.type ? (
              <>
                <div className="flex h-6 w-6 flex-shrink-0 items-center">
                  <LanguageIcon language={data.type} />
                </div>
                <h3 className="truncate font-medium tracking-tight">{data.name}</h3>
              </>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </div>
          <div className="flex flex-row-reverse items-center gap-1">
            {additionalActions}
            <TooltipPopover label="Reload schema">
              <Button onClick={handleReload} variant="ghost" size="icon-sm" className="text-muted-foreground">
                <RefreshIcon className={cn(isLoading && 'animate-spin')} />
              </Button>
            </TooltipPopover>
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
            additionalDropdownItems={additionalDropdownItems}
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
  additionalDropdownItems,
  eventSource,
}: {
  index: number;
  data: Table;
  connectionType: ConnectionType;
  additionalDropdownItems: ConnectionSchemaBrowserProps['additionalDropdownItems'];
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
      onClick: NonNullable<ConnectionSchemaBrowserProps['additionalDropdownItems']>[number]['onClick'];
    }) => {
      trackEvent('[ConnectionSchemaBrowser].clickDropdownItem', { eventSource, label });
      onClick({
        tableName: name,
        tableQuery: getTableQuery({ table: data, connectionType }),
      });
    },
    [eventSource, name, data, connectionType]
  );

  const handleCopyNameClick = useCallback(() => {
    trackEvent('[ConnectionSchemaBrowser].clickCopyName', { eventSource });
    navigator.clipboard.writeText(name);
  }, [name, eventSource]);

  const handleCopyQueryClick = useCallback(() => {
    trackEvent('[ConnectionSchemaBrowser].clickCopyQuery', { eventSource });
    const query = getTableQuery({ table: data, connectionType });
    navigator.clipboard.writeText(query);
  }, [eventSource, data, connectionType]);

  return (
    <div className="group relative">
      <button
        className={
          'flex h-7 w-full min-w-0 flex-initial cursor-default items-center pl-2 pr-10 font-normal hover:bg-accent'
        }
        onClick={handleTableClick}
      >
        <div className="-ml-0.5 flex h-6 w-6 flex-none items-center">
          <ChevronRightIcon className={cn('text-muted-foreground', isExpanded && 'rotate-90')} />
        </div>
        <div className="truncate leading-normal">{name}</div>
        <div className="ml-2 flex flex-none items-center text-xs text-muted-foreground">{columns.length} cols</div>
      </button>
      <div className="absolute right-2 top-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={handleDropdownClick}>
              <MoreHorizIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {additionalDropdownItems && (
              <>
                {additionalDropdownItems.map(({ label, onClick, Icon }) => (
                  <DropdownMenuItem key={label} onClick={() => handleDropdownMenuItemClick({ label, onClick })}>
                    <Icon className="mr-2" /> {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onClick={handleCopyNameClick}>
              <CopyIcon className="mr-2" /> Copy name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyQueryClick}>
              <CopyIcon className="mr-2" /> Copy query
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <ul className={cn('pl-8 pr-2')}>
          {columns.length ? (
            columns.map(({ name, type, is_nullable }, k) => (
              <li key={k} className="border border-l border-transparent border-l-border pl-0.5">
                <div className="flex w-full items-center gap-1 py-0.5 pl-2">
                  <div className="truncate after:ml-1 after:text-muted-foreground after:opacity-30 after:content-['/']">
                    {name}
                  </div>

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
    default:
      return '';
  }
}
