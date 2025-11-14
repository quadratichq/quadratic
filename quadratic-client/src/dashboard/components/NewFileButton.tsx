import { codeCellsById } from '@/app/helpers/codeCellLanguage';
import { supportedFileTypes } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { SNIPPET_PY_API } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { AIChatDialog } from '@/dashboard/components/AIChatDialog';
import { ConnectionSelectorDialog } from '@/dashboard/components/ConnectionSelectorDialog';
import { FileUploadDialog } from '@/dashboard/components/FileUploadDialog';
import { StartWithAIDialog } from '@/dashboard/components/StartWithAIDialog';
import { TemplateSelectorDialog } from '@/dashboard/components/TemplateSelectorDialog';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
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
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
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
import { useRef, useState } from 'react';
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
  const [isStartWithAIOpen, setIsStartWithAIOpen] = useState(false);
  const [isConnectionSelectorOpen, setIsConnectionSelectorOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [aiChatType, setAIChatType] = useState<'web' | 'ai-message' | null>(null);

  const handleStartWithAISelect = (option: string) => {
    setIsStartWithAIOpen(false);
    if (option === 'file') {
      setIsFileUploadOpen(true);
    } else if (option === 'database') {
      setIsConnectionSelectorOpen(true);
    } else if (option === 'template') {
      setIsTemplateSelectorOpen(true);
    } else if (option === 'web' || option === 'other') {
      setAIChatType(option === 'web' ? 'web' : 'ai-message');
      setIsAIChatOpen(true);
    } else {
      // TODO: Handle other options
      console.log('Selected option:', option);
    }
  };

  const handleSelectTemplate = async (publicFileUrlInProduction: string) => {
    // Check file limit
    const { hasReachedLimit } = await apiClient.teams.fileLimit(teamUuid, isPrivate);
    if (hasReachedLimit) {
      showUpgradeDialog('fileLimitReached');
      return;
    }

    // Create file from template with prompt
    const to = ROUTES.CREATE_FILE_EXAMPLE({
      teamUuid,
      publicFileUrlInProduction,
      additionalParams: `prompt=${encodeURIComponent("I've added my data to the sheet. Help me understand it.")}`,
    });
    window.location.href = to;
  };

  const handleFileSelect = (files: File[]) => {
    handleFileImport({
      files,
      isPrivate,
      teamUuid,
      prompt: "I've added my data to the sheet. Help me understand it.",
    });
  };

  const handleAIChatSubmit = async (message: string) => {
    // Check file limit
    const { hasReachedLimit } = await apiClient.teams.fileLimit(teamUuid, isPrivate);
    if (hasReachedLimit) {
      showUpgradeDialog('fileLimitReached');
      return;
    }

    // Create a new file with the prompt
    const to = ROUTES.CREATE_FILE(teamUuid, {
      private: isPrivate,
      prompt: message,
    });
    window.location.href = to;
  };

  const handleSelectConnection = (connectionUuid: string, connectionType: ConnectionType) => {
    // Find the connection to get its name
    const connection = connections.find((c) => c.uuid === connectionUuid);
    const connectionName = connection?.name || 'this connection';

    // Create a blank file (not with code cell state)
    const to = ROUTES.CREATE_FILE(teamUuid, {
      private: isPrivate,
    });

    // Add URL params to open AI analyst with connection context and prompt
    const url = new URL(to, window.location.origin);
    url.searchParams.set('open-ai-analyst', 'true');
    url.searchParams.set('connection-uuid', connectionUuid);
    url.searchParams.set('prompt', `I'm looking at ${connectionName}, can you tell me a quick blurb about each table?`);
    window.location.href = url.pathname + url.search;
  };

  const handleCreateNewConnection = () => {
    navigate(ROUTES.TEAM_CONNECTIONS(teamUuid));
  };

  return (
    <div className="flex flex-row-reverse gap-2">
      <Button
        variant="default"
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
      <Button variant="outline" onClick={() => setIsStartWithAIOpen(true)}>
        <AIIcon className="mr-2" />
        Start with AI
      </Button>
      <StartWithAIDialog
        open={isStartWithAIOpen}
        onOpenChange={setIsStartWithAIOpen}
        onSelect={handleStartWithAISelect}
      />
      <ConnectionSelectorDialog
        open={isConnectionSelectorOpen}
        onOpenChange={setIsConnectionSelectorOpen}
        connections={connections}
        teamUuid={teamUuid}
        isPrivate={isPrivate}
        onSelectConnection={handleSelectConnection}
        onCreateNew={handleCreateNewConnection}
        onBack={() => {
          setIsConnectionSelectorOpen(false);
          setIsStartWithAIOpen(true);
        }}
      />
      <AIChatDialog
        open={isAIChatOpen}
        onOpenChange={setIsAIChatOpen}
        onSubmit={handleAIChatSubmit}
        onBack={() => {
          setIsAIChatOpen(false);
          setIsStartWithAIOpen(true);
        }}
        title={aiChatType === 'web' ? 'Start with web data' : 'Start with AI message'}
        description={
          aiChatType === 'web'
            ? 'Describe the web data you want to analyze'
            : 'Describe what you want to analyze or ask a question'
        }
        placeholder={aiChatType === 'web' ? 'e.g., Analyze sales data from our website API...' : 'Ask a question…'}
        showAsChatBox={aiChatType === 'ai-message'}
      />
      <FileUploadDialog
        open={isFileUploadOpen}
        onOpenChange={setIsFileUploadOpen}
        onFileSelect={handleFileSelect}
        onBack={() => {
          setIsFileUploadOpen(false);
          setIsStartWithAIOpen(true);
        }}
        accept={supportedFileTypes.join(',')}
      />
      <TemplateSelectorDialog
        open={isTemplateSelectorOpen}
        onOpenChange={setIsTemplateSelectorOpen}
        teamUuid={teamUuid}
        isPrivate={isPrivate}
        onSelectTemplate={handleSelectTemplate}
        onBack={() => {
          setIsTemplateSelectorOpen(false);
          setIsStartWithAIOpen(true);
        }}
      />
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
