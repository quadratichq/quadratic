import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { fileDragDropModalAtom } from '@/dashboard/atoms/fileDragDropModalAtom';
import { ConnectionsIcon } from '@/dashboard/components/CustomRadixIcons';
import { FileDragDrop } from '@/dashboard/components/FileDragDrop';
import { useConnectionSchemaBrowserTableQueryActionNewFile } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { PrivateFileToggle } from '@/shared/components/connections/PrivateFileToggle';
import { ROUTES } from '@/shared/constants/routes';
import { useNewFileFromStatePythonApi } from '@/shared/hooks/useNewFileFromState';
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
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigation } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';

type Props = {
  connections: ConnectionList;
  onClose: () => void;
  teamUuid: string;
  isPrivate: boolean;
};

export function NewFileDialog({ connections, teamUuid, onClose, isPrivate: initialIsPrivate }: Props) {
  const location = useLocation();
  const navigation = useNavigation();
  const [isPrivate, setIsPrivate] = useState<boolean>(!!initialIsPrivate);
  const [activeConnectionUuid, setActiveConnectionUuid] = useState<string>('');
  const handleFileImport = useFileImport();
  const newFileApiHref = useNewFileFromStatePythonApi({ isPrivate, teamUuid });

  const gridItemClassName =
    'flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-4 pt-5 w-full group';
  const gridItemInteractiveClassName = 'hover:bg-accent hover:text-foreground cursor-pointer';
  const activeConnection = connections.find((connection) => connection.uuid === activeConnectionUuid);

  // Do an in-memory navigation if we're not in the app
  const reloadDocument = location.pathname.startsWith('/file/');

  const setFileDragDropState = useSetRecoilState(fileDragDropModalAtom);
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      setFileDragDropState({ show: true, teamUuid, isPrivate });
    },
    [isPrivate, setFileDragDropState, teamUuid]
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      {/* overflow: visible here fixes a bug with the tooltip being cut off */}
      <DialogContent className="relative max-w-xl overflow-visible" onDragEnter={handleDragEnter}>
        {navigation.state !== 'idle' && (
          <div className="absolute left-0 right-0 top-0 h-full w-full bg-background/60" />
        )}
        <DialogHeader className="space-y-0">
          <DialogTitle className="flex h-7 items-center gap-1.5">
            {activeConnection ? (
              <>
                <Button
                  onClick={() => setActiveConnectionUuid('')}
                  variant="ghost"
                  size="icon-sm"
                  disabled={!activeConnection}
                >
                  <ArrowLeftIcon />
                </Button>
                New file from connection
              </>
            ) : (
              'New file'
            )}
            {isPrivate && <LockClosedIcon className="mr-0.5" />}
          </DialogTitle>
          <DialogDescription asChild>
            <PrivateFileToggle
              className="text-muted-foreground"
              isPrivate={isPrivate}
              onToggle={() => setIsPrivate((prev) => !prev)}
            >
              Create in:{' '}
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
                onClick={() => {
                  onClose();
                  handleFileImport({ isPrivate, teamUuid });
                }}
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
                reloadDocument={reloadDocument}
                onClick={onClose}
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
              {connections.length > 0 ? (
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
                <div className="border-t border-border p-2 text-center text-sm text-muted-foreground">
                  No connections,{' '}
                  <Link
                    to={ROUTES.TEAM_CONNECTIONS(teamUuid)}
                    className="underline hover:text-primary"
                    reloadDocument={reloadDocument}
                    onClick={onClose}
                  >
                    create one
                  </Link>
                  .
                </div>
              )}
            </li>
          </ul>
        )}

        <FileDragDrop />
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
      teamUuid={teamUuid}
    />
  );
}
