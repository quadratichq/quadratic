import { codeCellsById } from '@/app/helpers/codeCellLanguage';
import { supportedFileTypes } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { AddIcon, ApiIcon, ArrowDropDownIcon, DatabaseIcon, ExamplesIcon, FileIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { ROUTES } from '@/shared/constants/routes';
import { newNewFileFromStateConnection } from '@/shared/hooks/useNewFileFromState';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog } from '@/shared/shadcn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';

const CONNECTIONS_DISPLAY_LIMIT = 3;
const stateToInsertAndRun = { language: 'Python', codeString: SNIPPET_PY_API } as const;

export function NewFileButton({ isPrivate }: { isPrivate: boolean }) {
  const {
    activeTeam: {
      connections,
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();
  const navigate = useNavigate();
  const handleFileImport = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreConnectionsCount = connections.length - CONNECTIONS_DISPLAY_LIMIT;

  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        asChild
        className="gap-2"
        onClick={async (e) => {
          const { hasReachedLimit } = await apiClient.teams.fileLimit(teamUuid, isPrivate);
          if (hasReachedLimit) {
            e.preventDefault();
            showUpgradeDialog('fileLimitReached');
            return;
          }
        }}
      >
        <Link to={ROUTES.FILES_CREATE_AI}>
          Start with <span className="rounded-md bg-background/20 px-2 py-0.5 text-xs font-semibold">AI</span>
        </Link>
      </Button>
      <Button
        variant="outline"
        onClick={async (e) => {
          e.preventDefault();
          const { hasReachedLimit } = await apiClient.teams.fileLimit(teamUuid, isPrivate);
          if (hasReachedLimit) {
            showUpgradeDialog('fileLimitReached');
            return;
          }
          window.location.href = ROUTES.CREATE_FILE(teamUuid, { private: isPrivate });
        }}
      >
        New file
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept={supportedFileTypes.join(',')}
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            handleFileImport({ files: Array.from(files), isPrivate, teamUuid });
          }
        }}
      />
      <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Import <ArrowDropDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Data from…</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileIcon className="mr-3 text-primary" />
              <span className="flex flex-col">
                Local file
                <span className="text-xs text-muted-foreground">.csv, .xlsx, .pqt, .grid</span>
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                reloadDocument
                to={ROUTES.CREATE_FILE(teamUuid, { state: stateToInsertAndRun, private: isPrivate })}
              >
                <ApiIcon className="mr-3 text-primary" />
                <span className="flex flex-col">
                  API
                  <span className="text-xs text-muted-foreground">Fetch data over HTTP with code</span>
                </span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link to={ROUTES.TEMPLATES} className="flex items-center">
                <ExamplesIcon className="mr-3 text-primary" />

                <span className="flex flex-col">
                  Templates
                  <span className="text-xs text-muted-foreground">Files from the Quadratic team</span>
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Data from connections</DropdownMenuLabel>
            {connections.slice(0, CONNECTIONS_DISPLAY_LIMIT).map(({ uuid, name, type }) => {
              const { label } = codeCellsById[type];
              const to = newNewFileFromStateConnection({
                isPrivate,
                teamUuid,
                query: '',
                connectionType: type,
                connectionUuid: uuid,
              });
              return (
                <DropdownMenuItem key={uuid} asChild className="max-w-xs">
                  <Link to={to} reloadDocument>
                    <div className="mr-3">
                      <LanguageIcon language={type} />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{name}</span>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })}
            {moreConnectionsCount > 0 && (
              <DropdownMenuItem onClick={() => navigate(ROUTES.TEAM_CONNECTIONS(teamUuid))}>
                <DatabaseIcon className="mr-3 text-muted-foreground" />
                <span className="flex flex-col">
                  View all connections
                  <span className="text-xs text-muted-foreground">{moreConnectionsCount} more</span>
                </span>
              </DropdownMenuItem>
            )}
            {connections.length === 0 && (
              <DropdownMenuItem onClick={() => navigate(ROUTES.TEAM_CONNECTIONS(teamUuid))}>
                <AddIcon className="mr-3 text-muted-foreground" />
                <span className="flex flex-col">
                  Add a connection
                  <span className="text-xs text-muted-foreground">Postgres, SQL, Snowflake, & more</span>
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Dialog>
    </div>
  );
}
