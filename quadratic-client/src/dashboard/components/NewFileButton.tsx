import { codeCellsById } from '@/app/helpers/codeCellLanguage';
import { supportedFileTypes } from '@/app/helpers/files';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import {
  AddIcon,
  AIIcon,
  ApiIcon,
  ArrowDropDownIcon,
  DatabaseIcon,
  ExamplesIcon,
  FileIcon,
} from '@/shared/components/Icons';
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
import { isMobile } from 'react-device-detect';
import { Link, useNavigate } from 'react-router';

const CONNECTIONS_DISPLAY_LIMIT = 3;

const stateToInsertAndRun = {
  codeString: SNIPPET_PY_API,
  language: 'Python' as CodeCellLanguage,
};

export function NewFileButton() {
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

  // Sets the creation of new files as private by default
  const isPrivate = true;

  if (isMobile) {
    return null;
  }

  return (
    <div className="hidden flex-row-reverse gap-2 md:flex">
      <Button
        data-testid="files-list-new-file-button"
        variant="default"
        onClick={(e) => {
          e.preventDefault();
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
            <DropdownMenuItem
              onClick={() => {
                navigate(`${ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)}${isPrivate ? '?private=true' : ''}`);
              }}
            >
              <AIIcon className="mr-3" />
              <span className="flex flex-col">
                Start with AI
                <span className="text-xs text-muted-foreground">Import data starting with AI</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Data from…</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileIcon className="mr-3" />
              <span className="flex flex-col">
                Local file
                <span className="text-xs text-muted-foreground">.csv, .xlsx, .pqt, .grid</span>
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                window.location.href = ROUTES.CREATE_FILE(teamUuid, {
                  state: stateToInsertAndRun,
                  private: isPrivate,
                });
              }}
            >
              <ApiIcon className="mr-3" />
              <span className="flex flex-col">
                API
                <span className="text-xs text-muted-foreground">Fetch data over HTTP with code</span>
              </span>
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
