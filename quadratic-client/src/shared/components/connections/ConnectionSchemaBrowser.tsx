import { ChevronRightIcon, RefreshIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { Link } from 'react-router';

export const ConnectionSchemaBrowser = ({
  TableQueryAction,
  selfContained,
  teamUuid,
  type,
  uuid,
}: {
  TableQueryAction: React.FC<{ query: string }>;
  teamUuid: string;
  selfContained?: boolean;
  type?: ConnectionType;
  uuid?: string;
}) => {
  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({ type, uuid, teamUuid });
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);

  if (type === undefined || uuid === undefined) return null;

  // Designed to live in a box that takes up the full height of its container
  return (
    <div
      className={cn('h-full overflow-auto text-sm', selfContained && 'h-96 overflow-auto rounded border border-border')}
    >
      <div className={cn('sticky top-0 z-10 flex items-center justify-between bg-background px-2 py-1.5')}>
        <div className="flex items-center gap-1 truncate">
          {data && data.type ? (
            <div className="flex h-6 w-6 flex-shrink-0 items-center">
              <LanguageIcon language={data.type} />
            </div>
          ) : null}
          <h3 className="truncate font-medium tracking-tight">{data?.name ? data.name : ''}</h3>
        </div>
        <div className="flex flex-row-reverse items-center gap-1">
          {data && !data.tables[selectedTableIndex] && <div className="text-center">No tables in this connection</div>}
          <TableQueryAction
            query={
              !isLoading && data && data.tables[selectedTableIndex]
                ? getTableQuery({ table: data.tables[selectedTableIndex], connectionKind: data.type })
                : ''
            }
          />
          <TooltipPopover label="Reload schema">
            <Button onClick={reloadSchema} variant="ghost" size="icon-sm" className="text-muted-foreground">
              <RefreshIcon className={cn(isLoading && 'animate-spin')} />
            </Button>
          </TooltipPopover>
        </div>
      </div>
      {isLoading && data === undefined && (
        <div className="mb-4 flex min-h-16 items-center justify-center text-muted-foreground">Loading…</div>
      )}

      {data && (
        <RadioGroup
          value={String(selectedTableIndex)}
          onValueChange={(newIndexStr) => {
            const newIndex = Number(newIndexStr);
            setSelectedTableIndex(newIndex);
          }}
          className="block"
        >
          {data.tables.map((table, i) => (
            <TableListItem index={i} selfContained={selfContained} data={table} key={i} />
          ))}
        </RadioGroup>
      )}
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
  selfContained,
}: {
  index: number;
  data: Table;
  selfContained?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const id = `sql-table-${index}`;

  return (
    <div className="group">
      <Label
        htmlFor={id}
        className={cn('flex items-center justify-between group-has-[button[data-state=checked]]:bg-accent')}
      >
        <button
          className={cn(
            'flex h-8 min-w-0 flex-initial cursor-default items-center font-normal',
            selfContained ? 'px-2' : 'px-1.5'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
        >
          <div className="flex h-6 w-6 flex-none items-center">
            <ChevronRightIcon className={cn('text-muted-foreground', isExpanded && 'rotate-90')} />
          </div>
          <div className="truncate leading-normal">{name}</div>
          <div className="ml-2 flex flex-none items-center text-xs text-muted-foreground">{columns.length} cols</div>
        </button>

        <RadioGroupItem value={String(index)} id={id} className="ml-4 mr-3 cursor-default" />
      </Label>
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
    case 'MYSQL':
      return `SELECT * FROM \`${schema}\`.\`${name}\` LIMIT 100`;
    case 'MSSQL':
      return `SELECT TOP 100 * FROM [${schema}].[${name}]`;
    case 'SNOWFLAKE':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    default:
      return '';
  }
}
