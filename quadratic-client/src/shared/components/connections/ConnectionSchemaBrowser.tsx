import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { KeyboardArrowRight } from '@mui/icons-material';
import { ReloadIcon } from '@radix-ui/react-icons';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';

export const ConnectionSchemaBrowser = ({
  TableQueryAction,
  selfContained,
  type,
  uuid,
}: {
  TableQueryAction: React.FC<{ query: string }>;
  selfContained?: boolean;
  type?: ConnectionType;
  uuid?: string;
}) => {
  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({ type, uuid });

  if (type === undefined || uuid === undefined) return null;

  // Designed to live in a box that takes up the full height of its container
  return (
    <div
      className={cn(
        'h-full overflow-auto text-sm',
        selfContained && 'h-[17.5rem] overflow-auto rounded border border-border'
      )}
    >
      <div className={cn('flex items-center justify-between pb-1', selfContained ? 'px-2 pt-1.5' : 'px-2')}>
        <div className="flex items-center gap-1 truncate">
          {data && data.type ? (
            <div className="flex h-6 w-6 items-center ">
              <LanguageIcon
                // TODO: (jimniels) fix this
                language={data.type}
                sx={{ width: 15, height: 15 }}
              />
            </div>
          ) : null}
          <h3 className="truncate font-medium tracking-tight">{data?.name ? data.name : ''}</h3>
        </div>
        <div className="flex items-center gap-1">
          {/* <Type variant="caption">{data?.tables ? data.tables.length + ' tables' : ''}</Type> */}
          <TooltipPopover label="Reload schema">
            <Button onClick={reloadSchema} variant="ghost" size="icon-sm">
              <ReloadIcon className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </TooltipPopover>
        </div>
      </div>
      {isLoading && data === undefined && (
        <div className="mb-4 flex min-h-16 items-center justify-center text-muted-foreground">Loading…</div>
      )}
      {data && (
        <ul className="text-sm">
          {data.tables.map((table, i) => (
            <TableListItem
              selfContained={selfContained}
              data={table}
              key={i}
              tableQuery={<TableQueryAction query={getTableQuery({ table, connectionKind: data.type })} />}
            />
          ))}
        </ul>
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
              // Enhancement: do the logic to know when to do an in-memory navigation or redirect the document entirely
              to={ROUTES.TEAM_SHORTCUT.CONNECTIONS}
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
  data: { name, columns, schema },
  selfContained,
  tableQuery,
}: {
  data: Table;
  selfContained?: boolean;
  tableQuery: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li className="group relative z-10">
      <div className={cn('sticky top-0', isExpanded && 'z-10 bg-accent')}>
        <button
          className={cn(
            'z-10 flex h-8 w-full cursor-default items-stretch justify-between gap-1 bg-background group-hover:bg-accent',
            isExpanded && 'bg-accent',
            selfContained ? 'px-2' : 'px-1'
          )}
          onClick={() => {
            setIsExpanded((prev) => !prev);
          }}
        >
          <div className="flex items-center truncate">
            <div className="flex h-6 w-6 items-center justify-center">
              <KeyboardArrowRight
                fontSize="inherit"
                className={cn(isExpanded && 'rotate-90', 'text-xs text-muted-foreground')}
              />
            </div>
            <div className="truncate">{name}</div>
          </div>
        </button>
        <div
          className={cn(
            `absolute top-0.5 z-10 hidden group-hover:block`,
            isExpanded && 'block',
            selfContained ? 'right-2' : 'right-2'
          )}
        >
          {tableQuery}
        </div>
      </div>
      {isExpanded && (
        <ul className={cn('pr-2', selfContained ? 'pl-5' : 'pl-4')}>
          {columns.length ? (
            columns.map(({ name, type, is_nullable }, k) => (
              <li key={k} className="border border-l border-transparent border-l-border pl-3">
                <div className="flex w-full items-center gap-1 py-0.5 pl-2">
                  <div className="truncate after:ml-1 after:text-muted-foreground after:opacity-30 after:content-['/']">
                    {name}
                  </div>

                  <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
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
    </li>
  );
}

function getTableQuery({ table: { name, schema }, connectionKind }: { table: Table; connectionKind: string }) {
  switch (connectionKind) {
    case 'POSTGRES':
      return `SELECT * FROM "${schema}"."${name}" LIMIT 100`;
    case 'MYSQL':
      return `SELECT * FROM \`${schema}\`.\`${name}\` LIMIT 100`;
    default:
      return '';
  }
}
