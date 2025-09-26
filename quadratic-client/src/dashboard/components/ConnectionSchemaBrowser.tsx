import { ChevronRightIcon, CloseIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

export const ConnectionSchemaBrowser = ({
  TableQueryAction,
  teamUuid,
  type,
  uuid,
  onTableQueryAction,
}: {
  TableQueryAction: React.FC<{ query: string }>;
  teamUuid: string;
  type?: ConnectionType;
  uuid?: string;
  onTableQueryAction?: (query: string) => void;
}) => {
  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({ type, uuid, teamUuid });
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
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

  useEffect(() => {
    if (!data) return;
    if (filteredTables.length === 0) {
      setSelectedTableIndex(-1);
      return;
    }
  }, [data, filteredTables]);

  if (type === undefined || uuid === undefined) return null;

  // Designed to live in a box that takes up the full height of its container
  return (
    <div className={cn('h-full overflow-auto px-3 text-sm')}>
      <div className="sticky top-0 z-10 mb-1.5 flex flex-col gap-1 bg-background pt-3">
        <div className="relative">
          <Input
            ref={inputRef}
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value);
              setSelectedTableIndex(0);
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
                setSelectedTableIndex(0);
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
            selected={selectedTableIndex === index}
            onClick={() => {
              setSelectedTableIndex(index);
              onTableQueryAction?.(getTableQuery({ table: filteredTables[index], connectionKind: data.type }));
            }}
          />
        ))}

      {/* TODO: Add error state */}
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
  data: { name, columns, schema },
  onClick,
  selected,
}: {
  index: number;
  data: Table;
  onClick: () => void;
  selected: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="group relative">
      <button
        className={cn(
          'flex h-8 w-full cursor-default items-center rounded font-normal hover:bg-accent',
          'pl-8 pr-2',
          selected && 'bg-accent'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className="truncate leading-normal">{name}</div>
        <div className="ml-auto flex flex-none items-center text-xs text-muted-foreground">{columns.length} cols</div>
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="absolute left-0 top-0.5"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <ChevronRightIcon className={cn('text-muted-foreground', isExpanded && 'rotate-90')} />
      </Button>

      {isExpanded && (
        <ul className={cn('pl-8 pr-2')}>
          {columns.length ? (
            columns.map(({ name, type, is_nullable }, k) => (
              <li key={k} className="border border-l border-transparent border-l-border pl-0">
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

function getTableQuery({ table: { name, schema }, connectionKind }: { table: Table; connectionKind: string }) {
  switch (connectionKind) {
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
