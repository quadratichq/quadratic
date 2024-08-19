import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { PrivateFileToggle } from '@/shared/components/connections/PrivateFileToggle';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  MixIcon,
  PlusIcon,
  RocketIcon,
} from '@radix-ui/react-icons';
import { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  connections: ConnectionList;
  onClose: () => void;
  teamUuid: string;
  isPrivate: boolean;
};

export function NewFileDialog({ connections, teamUuid, onClose, isPrivate: intialIsPrivate }: Props) {
  const [isPrivate, setIsPrivate] = useState<boolean>(!!intialIsPrivate);
  const [activeConnectionUuid, setActiveConnectionUuid] = useState<string>('');
  const gridItemClassName =
    'flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-4 pt-5 w-full group';
  const gridItemInteractiveClassName = 'hover:bg-accent hover:text-foreground cursor-pointer';

  // TODO: style a zero state
  const hasConnections = connections.length > 0;

  const activeConnection = connections.find((connection) => connection.uuid === activeConnectionUuid);

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
        <DialogHeader className="relative pl-12">
          <Button
            onClick={() => setActiveConnectionUuid('')}
            variant="ghost"
            size="icon"
            disabled={!activeConnection}
            className="absolute left-0 top-3"
          >
            <ArrowLeftIcon />
          </Button>
          <DialogTitle className="flex items-center gap-1.5">
            {activeConnection ? 'New file from connection' : 'New file'}
            {isPrivate && <LockClosedIcon className="mr-0.5" />}
          </DialogTitle>
          <DialogDescription asChild>
            <PrivateFileToggle
              className="flex flex-row items-center gap-1 font-medium"
              isPrivate={isPrivate}
              onToggle={() => setIsPrivate((prev) => !prev)}
            >
              Private to me
            </PrivateFileToggle>
          </DialogDescription>
        </DialogHeader>
        {activeConnection ? (
          <SchemaBrowser
            connectionUuid={activeConnection.uuid}
            connectionType={activeConnection.type}
            isPrivate={isPrivate}
            teamUuid={teamUuid}
          />
        ) : (
          <ul className="grid grid-cols-4 grid-rows-[1f_1fr_auto] gap-2 text-sm">
            <li className={`col-span-1`}>
              <Link
                to={isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid)}
                className={cn(gridItemClassName, gridItemInteractiveClassName, 'border-primary text-muted-foreground')}
              >
                <ItemIcon>
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
                <ItemIcon disabled>
                  <ConnectionsIcon className="text-muted-foreground" />
                </ItemIcon>
                Query data from a connection
              </div>
              {hasConnections ? (
                <ul className="w-full border-border">
                  {connections.slice(0, 5).map((connection) => (
                    <li key={connection.uuid}>
                      <button
                        className="flex w-full cursor-pointer items-center gap-4 border-t border-border px-4 py-2 hover:bg-accent"
                        onClick={() => setActiveConnectionUuid(connection.uuid)}
                      >
                        <LanguageIcon language={connection.type} sx={{ width: 18, height: 18 }} />
                        {connection.name}
                        <ChevronRightIcon className="ml-auto text-muted-foreground opacity-50" />
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

function ItemIcon({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <div
      className={cn(
        `flex h-6 w-6 items-center justify-center rounded bg-accent text-primary`,
        disabled ? '' : `group-hover:bg-primary group-hover:text-background`
      )}
    >
      {children}
    </div>
  );
}

function SchemaBrowser({
  connectionType,
  connectionUuid,
  isPrivate,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string;
  isPrivate: boolean;
  teamUuid: string;
}) {
  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionNewFile({
    connectionType,
    connectionUuid,
    isPrivate,
    teamUuid,
  });

  return (
    <ConnectionSchemaBrowser
      selfContained={true}
      type={connectionType}
      uuid={connectionUuid}
      TableQueryAction={TableQueryAction}
    />
  );
}
