import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { useSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useSchemaBrowserTableQueryActionNewFile';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ROUTES } from '@/shared/constants/routes';
import { SchemaBrowser } from '@/shared/hooks/useSchemaBrowser';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { ArrowDownIcon, ChevronRightIcon, LockClosedIcon, MixIcon, PlusIcon, RocketIcon } from '@radix-ui/react-icons';
import { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  connections: ConnectionList;
  onClose: () => void;
  teamUuid: string;
  isPrivate?: boolean;
};

export function NewFileDialog({ connections, teamUuid, onClose, isPrivate }: Props) {
  const [activeConnectionUuid, setActiveConnectionUuid] = useState<string>('');
  const gridItemClassName =
    'flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-4 pt-5 w-full';
  const gridItemInteractiveClassName = 'hover:bg-accent hover:text-foreground cursor-pointer';

  // TODO: style
  const hasConnections = connections.length > 0;

  // TODO: implement private

  const activeConnection = connections.find((connection) => connection.uuid === activeConnectionUuid);
  const headerLabel = isPrivate ? 'New private file' : 'New file';

  // Create a new file from an API snippet
  const stateUrlParam = {
    codeString: SNIPPET_PY_API,
    language: 'Python' as CodeCellLanguage,
  };
  const newFileApiHref = isPrivate
    ? ROUTES.CREATE_FILE_PRIVATE(teamUuid, stateUrlParam)
    : ROUTES.CREATE_FILE(teamUuid, stateUrlParam);

  return (
    <Dialog open={true} onOpenChange={(open) => onClose()}>
      {/* overflow: visible here fixes a bug with the tooltip being cut off */}
      <DialogContent className="max-w-xl overflow-visible">
        <DialogHeader>
          <DialogTitle>
            <div className="flex h-6 items-center gap-2">
              {isPrivate && <LockClosedIcon />}
              {activeConnection ? (
                <>
                  <button
                    className="text-muted-foreground underline hover:text-primary"
                    onClick={() => setActiveConnectionUuid('')}
                  >
                    {headerLabel}
                  </button>
                  <ChevronRightIcon className="text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <LanguageIcon language={activeConnection.type} />
                    <span>From {connectionsByType[activeConnection.type].name} connection</span>
                  </div>
                </>
              ) : (
                headerLabel
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        {activeConnection ? (
          <SchemaBrowserInternal connection={activeConnection} />
        ) : (
          <ul className="grid grid-cols-4 grid-rows-[1f_1fr_auto] gap-2 text-sm">
            <li className={`col-span-1`}>
              <Link
                to={isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid)}
                className={cn(gridItemClassName, gridItemInteractiveClassName)}
              >
                <ItemIcon inverted>
                  <PlusIcon />
                </ItemIcon>
                Blank
              </Link>
            </li>
            <li className={`col-span-3`}>
              <button
                className={cn(
                  `border-dashed text-center text-muted-foreground`,
                  gridItemClassName,
                  gridItemInteractiveClassName
                )}
              >
                <ItemIcon>
                  <ArrowDownIcon />
                </ItemIcon>
                Import data from a file (.csv, .pqt, .xlsx, .grid)
              </button>
            </li>
            <li className={`col-span-2`}>
              <Link
                to={newFileApiHref}
                className={cn('text-muted-foreground', gridItemClassName, gridItemInteractiveClassName)}
              >
                <ItemIcon>
                  <RocketIcon />
                </ItemIcon>
                Fetch data from an API
              </Link>
            </li>
            <li className={`col-span-2`}>
              <Link
                to={ROUTES.EXAMPLES}
                className={cn(`text-muted-foreground`, gridItemClassName, gridItemInteractiveClassName)}
                onClick={() => {
                  onClose();
                }}
              >
                <ItemIcon>
                  <MixIcon />
                </ItemIcon>
                Learn from an example file
              </Link>
            </li>
            <li className={`col-span-4 rounded border border-border`}>
              <div className={`text-muted-foreground ${gridItemClassName} border-none`}>
                <ItemIcon>
                  <ConnectionsIcon />
                </ItemIcon>
                Query data from a connection
              </div>
              {hasConnections ? (
                <ul className="w-full border-border">
                  {connections.map((connection) => (
                    <li key={connection.uuid}>
                      <button
                        className="flex w-full cursor-pointer items-center gap-4 border-t border-border px-4 py-2 hover:bg-accent"
                        onClick={() => setActiveConnectionUuid(connection.uuid)}
                      >
                        <LanguageIcon language={connection.type} />
                        {connection.name}
                        <ChevronRightIcon className="ml-auto" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  You don’t have any yet ·{' '}
                  <Link to={ROUTES.TEAM_CONNECTIONS(teamUuid)} className="underline hover:text-primary">
                    Create one now
                  </Link>
                </div>
              )}
            </li>
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemIcon({ children, inverted }: { children: React.ReactNode; inverted?: boolean }) {
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded ${
        inverted ? 'bg-foreground text-background' : 'bg-accent text-foreground'
      }`}
    >
      {children}
    </div>
  );
}

function SchemaBrowserInternal({
  connection,
}: {
  connection: {
    uuid: string;
    name: string;
    createdDate: string;
    type: 'POSTGRES' | 'MYSQL';
  };
}) {
  const { tableQueryAction } = useSchemaBrowserTableQueryActionNewFile();

  return (
    <SchemaBrowser
      selfContained={true}
      connectionType={connection.type}
      connectionUuid={connection.uuid}
      tableQueryAction={tableQueryAction}
    />
  );
}
