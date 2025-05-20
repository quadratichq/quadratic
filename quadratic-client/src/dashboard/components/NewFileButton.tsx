import { codeCellsById } from '@/app/helpers/codeCellLanguage';
import { supportedFileTypes } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { AddIcon, ApiIcon, ArrowDropDownIcon, DatabaseIcon, DraftIcon, ExamplesIcon } from '@/shared/components/Icons';
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

export default function NewFileButton({ isPrivate }: { isPrivate: boolean }) {
  const {
    activeTeam: {
      connections,
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();
  const navigate = useNavigate();
  const handleFileImport = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-row-reverse gap-2">
      <Link to={ROUTES.CREATE_FILE(teamUuid, { private: isPrivate })} reloadDocument>
        <Button variant="default">New file</Button>
      </Link>
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
              <DraftIcon className="mr-3 text-primary" />
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
              <Link to="/examples" className="flex items-center">
                <ExamplesIcon className="mr-3 text-primary" />

                <span className="flex flex-col">
                  Examples
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
                <DropdownMenuItem key={uuid} asChild>
                  <Link to={to} reloadDocument>
                    <div className="mr-3">
                      <LanguageIcon language={type} />
                    </div>
                    <span className="flex flex-col">
                      {name}
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
            {connections.length > CONNECTIONS_DISPLAY_LIMIT && (
              <DropdownMenuItem onClick={() => navigate(ROUTES.TEAM_CONNECTIONS(teamUuid))}>
                <DatabaseIcon className="mr-3 text-muted-foreground" />
                <span className="flex flex-col">
                  View all connections
                  <span className="text-xs text-muted-foreground">
                    {connections.length - CONNECTIONS_DISPLAY_LIMIT} more
                  </span>
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
