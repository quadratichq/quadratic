import { aiChatFilesDirect } from '@/app/ai/aiChatFilesDirect';
import { getExtension, uploadFile } from '@/app/helpers/files';
import { authClient, requireAuth } from '@/auth/auth';
import type { GetConnections } from '@/routes/api.connections';
import { apiClient } from '@/shared/api/apiClient';
import { Connections } from '@/shared/components/connections/Connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { DatabaseIcon, FileIcon, SearchIcon, SettingsIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ArrowRightIcon, ChevronLeftIcon, UploadIcon } from '@radix-ui/react-icons';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, redirect, useFetcher, useLoaderData, useLocation, useNavigate, useSearchParams } from 'react-router';

type Step = 'connection' | 'describe';

const getStepFromPath = (pathname: string, teamUuid: string): Step => {
  if (pathname === ROUTES.TEAM_FILES_CREATE_AI_CONNECTION(teamUuid)) return 'connection';
  // All other routes go to describe (including base route, prompt, file, pdf, web)
  return 'describe';
};

interface UploadedFile {
  name: string;
  size: number;
  data: ArrayBuffer;
  type: string;
}

interface SelectedConnection {
  uuid: string;
  name: string;
  type: ConnectionType;
}

interface SuggestedPrompt {
  title: string;
  description: string;
  prompt: string;
}

const FILE_TYPES = ['.csv', '.xlsx', '.xls', '.parquet', '.parq', '.pqt'];
const PDF_TYPES = ['.pdf'];

const FILE_TYPE_NAMES: Record<string, string> = {
  '.csv': 'CSV',
  '.xlsx': 'Excel',
  '.xls': 'Excel',
  '.parquet': 'Parquet',
  '.parq': 'Parquet',
  '.pqt': 'Parquet',
  '.pdf': 'PDF',
};

const getFileTypeDisplay = (extensions: string[]): string => {
  const uniqueNames = new Set<string>();
  extensions.forEach((ext) => {
    const name = FILE_TYPE_NAMES[ext] || ext;
    uniqueNames.add(name);
  });
  return Array.from(uniqueNames).join(', ');
};

const DEFAULT_SUGGESTIONS: SuggestedPrompt[] = [
  {
    title: 'Financial Model',
    description: 'Build projections and valuations',
    prompt: 'Create a financial model with revenue projections, expense forecasts, and cash flow analysis',
  },
  {
    title: 'Supply Chain Tracker',
    description: 'Monitor inventory and logistics',
    prompt: 'Create a supply chain tracker with inventory levels, supplier lead times, and order fulfillment metrics',
  },
  {
    title: 'Project Management',
    description: 'Track tasks and milestones',
    prompt: 'Create a project management tracker with tasks, deadlines, team assignments, and milestone tracking',
  },
];

const WEB_SEARCH_EXAMPLES: string[] = [
  'Compare market cap of top 10 tech companies',
  'US GDP growth rate by quarter for 2024',
  'Population of major European cities',
];

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  await requireAuth(loaderArgs.request);
  const teamUuid = loaderArgs.params.teamUuid;
  if (!teamUuid) throw new Error('Team UUID is required');

  const teamData = await apiClient.teams.get(teamUuid);

  // Ensure the user has editor permissions (viewers cannot create files)
  if (!teamData.userMakingRequest.teamPermissions.includes('TEAM_EDIT')) {
    const message = encodeURIComponent('You can only view this team. Editors and owners can create files.');
    return redirect(`/?${SEARCH_PARAMS.SNACKBAR_MSG.KEY}=${message}`);
  }

  // Check if this is a new user coming from onboarding (check URL referrer or session)
  const url = new URL(loaderArgs.request.url);
  const isFromOnboarding = url.searchParams.get('onboarding') === 'true';

  return {
    connections: teamData.connections,
    teamUuid: teamData.team.uuid,
    sshPublicKey: teamData.team.sshPublicKey,
    isFromOnboarding,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections, teamUuid, sshPublicKey, isFromOnboarding } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const step = getStepFromPath(location.pathname, teamUuid);
  const isPrivate = searchParams.get('private') === 'true';

  // Track page load
  useEffect(() => {
    trackEvent('[StartWithAI].loaded', { step, isFromOnboarding });
  }, [step, isFromOnboarding]);

  // Helper to preserve search params when navigating
  const getRouteWithParams = (route: string) => {
    return isPrivate ? `${route}?private=true` : route;
  };
  const [prompt, setPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<SelectedConnection | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[]>(DEFAULT_SUGGESTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);

  // Connections dialog state
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [connectionsDialogInitialView, setConnectionsDialogInitialView] = useState<'new' | 'list'>('list');
  const [connectionsDialogInitialType, setConnectionsDialogInitialType] = useState<ConnectionType | undefined>(
    undefined
  );
  const connectionsFetcher = useFetcher<GetConnections>({ key: 'START_WITH_AI_CONNECTIONS_FETCHER' });

  // Fetch connections when dialog opens
  useEffect(() => {
    if (showConnectionsDialog && connectionsFetcher.state === 'idle' && connectionsFetcher.data === undefined) {
      connectionsFetcher.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [showConnectionsDialog, connectionsFetcher, teamUuid]);

  // Get the latest connections list (from fetcher or loader)
  const latestConnections = useMemo(
    () => connectionsFetcher.data?.connections ?? connections,
    [connectionsFetcher.data?.connections, connections]
  );
  const staticIps = useMemo(() => connectionsFetcher.data?.staticIps ?? [], [connectionsFetcher.data?.staticIps]);

  // When a new connection is added, auto-select it and close the dialog (for onboarding flow)
  const prevConnectionsLengthRef = useRef(connections.length);
  const connectionPrompt =
    'Show me the schema of this connection so I know what I can ask. Also inform me that if I want to open the schema viewer I can press the database icon in the AI chat.';

  useEffect(() => {
    if (latestConnections.length > prevConnectionsLengthRef.current) {
      // A new connection was added
      const newestConnection = latestConnections[0]; // Connections are sorted newest first
      if (newestConnection) {
        trackEvent('[StartWithAI].addConnection', { connectionType: newestConnection.type, source: 'dialog' });

        // For onboarding flow, navigate directly to the sheet with the new connection
        if (isFromOnboarding && showConnectionsDialog) {
          trackEvent('[StartWithAI].onboardingConnectionComplete', {
            connectionType: newestConnection.type,
          });
          navigate(
            ROUTES.CREATE_FILE(teamUuid, {
              private: isPrivate,
              prompt: connectionPrompt,
              connectionUuid: newestConnection.uuid,
              connectionType: newestConnection.type,
              connectionName: newestConnection.name,
            })
          );
        } else {
          // For non-onboarding, just select the connection
          setSelectedConnection({
            uuid: newestConnection.uuid,
            name: newestConnection.name,
            type: newestConnection.type,
          });
          // Close the dialog if it's open
          if (showConnectionsDialog) {
            setShowConnectionsDialog(false);
            setConnectionsDialogInitialView('list');
            setConnectionsDialogInitialType(undefined);
          }
        }
      }
    }
    prevConnectionsLengthRef.current = latestConnections.length;
  }, [latestConnections, showConnectionsDialog, isFromOnboarding, teamUuid, isPrivate, navigate]);

  const handleOpenConnectionsDialog = useCallback(
    (initialView: 'new' | 'list' = 'list', connectionType?: ConnectionType) => {
      trackEvent('[StartWithAI].openConnectionsDialog', { initialView, connectionType });
      setConnectionsDialogInitialView(initialView);
      setConnectionsDialogInitialType(connectionType);
      setShowConnectionsDialog(true);
    },
    []
  );

  // Reset initial view and type when dialog closes
  const handleConnectionsDialogChange = useCallback((open: boolean) => {
    setShowConnectionsDialog(open);
    if (!open) {
      setConnectionsDialogInitialView('list');
      setConnectionsDialogInitialType(undefined);
    }
  }, []);

  // Generate contextual suggestions when files or connections change
  useEffect(() => {
    if (uploadedFiles.length === 0 && !selectedConnection) {
      setSuggestions(DEFAULT_SUGGESTIONS);
      return;
    }

    const generateSuggestions = async () => {
      if (suggestionsAbortRef.current) {
        suggestionsAbortRef.current.abort();
      }
      suggestionsAbortRef.current = new AbortController();

      setIsLoadingSuggestions(true);

      try {
        const token = await authClient.getTokenOrRedirect();
        const endpoint = `${apiClient.getApiUrl()}/v0/ai/suggestions`;

        // Include file content for text-based files and PDFs to get better suggestions
        const filesWithContent = uploadedFiles.map((file) => {
          const isTextFile =
            file.type.startsWith('text/') ||
            file.type === 'application/json' ||
            file.type === 'application/csv' ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.tsv');

          const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

          let content: string | undefined;
          let contentEncoding: 'text' | 'base64' | undefined;

          if (isTextFile) {
            try {
              const decoder = new TextDecoder('utf-8');
              const fullContent = decoder.decode(file.data);
              // Limit content to first ~2000 chars for suggestions (just need headers/sample)
              content = fullContent.slice(0, 2000);
              contentEncoding = 'text';
            } catch {
              // If decoding fails, skip content
            }
          } else if (isPdf) {
            try {
              // Convert PDF to base64
              const bytes = new Uint8Array(file.data);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              content = btoa(binary);
              contentEncoding = 'base64';
            } catch {
              // If encoding fails, skip content
            }
          }

          return { name: file.name, type: file.type, content, contentEncoding };
        });

        const response = await fetch(endpoint, {
          method: 'POST',
          signal: suggestionsAbortRef.current.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamUuid,
            context: {
              files: filesWithContent,
              connectionName: selectedConnection?.name,
              connectionType: selectedConnection?.type,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate suggestions');
        }

        const data = await response.json();
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error generating suggestions:', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    generateSuggestions();

    return () => {
      suggestionsAbortRef.current?.abort();
    };
  }, [uploadedFiles, selectedConnection, teamUuid]);

  const handleFileUpload = async (fileTypes: string[], shouldNavigate = true) => {
    try {
      const files = await uploadFile(fileTypes);
      if (files.length > 0) {
        const newFiles: UploadedFile[] = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            size: file.size,
            data: await file.arrayBuffer(),
            type: file.type,
          }))
        );
        trackEvent('[StartWithAI].addFile', {
          fileCount: newFiles.length,
          fileTypes: newFiles.map((f) => f.type),
        });
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        if (shouldNavigate && step !== 'describe') {
          navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)));
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, acceptedTypes: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);

    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles) return;

    // Filter files by extension or mime type
    const supportedFiles = Array.from(droppedFiles).filter((file) => {
      const ext = `.${getExtension(file.name).toLowerCase()}`;
      return file.type.startsWith('image/') || acceptedTypes.includes(ext) || acceptedTypes.includes(file.type);
    });

    if (supportedFiles.length > 0) {
      const newFiles: UploadedFile[] = await Promise.all(
        supportedFiles.map(async (file) => ({
          name: file.name,
          size: file.size,
          data: await file.arrayBuffer(),
          type: file.type,
        }))
      );
      trackEvent('[StartWithAI].addFile', {
        fileCount: newFiles.length,
        fileTypes: newFiles.map((f) => f.type),
        method: 'drag-drop',
      });
      setUploadedFiles(newFiles);
      navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)));
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setDragOver(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOver(false);
    }
  };

  const handleSelectConnection = (connection: (typeof connections)[0]) => {
    trackEvent('[StartWithAI].addConnection', { connectionType: connection.type });
    setSelectedConnection({
      uuid: connection.uuid,
      name: connection.name,
      type: connection.type,
    });
    navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)));
  };

  const handleSubmitPrompt = useCallback(
    async (promptText: string, isSuggestion = false) => {
      if (!promptText.trim() || isSubmitting) return;

      if (isSuggestion) {
        trackEvent('[StartWithAI].selectSuggestion', { promptLength: promptText.length });
      }

      trackEvent('[StartWithAI].buildSpreadsheet', {
        hasFiles: uploadedFiles.length > 0,
        hasConnection: !!selectedConnection,
        promptLength: promptText.length,
        isPrivate,
      });

      setIsSubmitting(true);

      // Save files to IndexedDB so they can be picked up by the spreadsheet
      let chatId: string | undefined;
      if (uploadedFiles.length > 0) {
        chatId = crypto.randomUUID();
        await aiChatFilesDirect.saveFiles(
          chatId,
          uploadedFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            data: f.data,
          }))
        );
      }

      navigate(
        ROUTES.CREATE_FILE(teamUuid, {
          prompt: promptText,
          private: isPrivate,
          chatId,
          connectionUuid: selectedConnection?.uuid,
          connectionType: selectedConnection?.type,
          connectionName: selectedConnection?.name,
        })
      );
    },
    [uploadedFiles, selectedConnection, isPrivate, teamUuid, navigate, isSubmitting]
  );

  const handleBuildSpreadsheet = () => {
    if (!prompt.trim()) return;
    handleSubmitPrompt(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBuildSpreadsheet();
    }
  };

  // Main View
  return (
    <div
      className="relative flex h-full flex-col bg-background"
      {...(step === 'describe' && {
        onDrop: (e: DragEvent<HTMLDivElement>) => handleDrop(e, [...FILE_TYPES, ...PDF_TYPES]),
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
      })}
    >
      {/* Drag overlay - show on describe page */}
      {dragOver && step === 'describe' && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-background/90 px-12 py-8 shadow-lg">
            <UploadIcon className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold">Drop files here</p>
            <p className="text-sm text-muted-foreground">
              Supported: {getFileTypeDisplay([...FILE_TYPES, ...PDF_TYPES])}
            </p>
          </div>
        </div>
      )}

      {step === 'describe' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <QuadraticLogo />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Back to Dashboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
      )}

      <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
        <div className="w-full max-w-2xl">
          {/* Connection Selection Page */}
          {step === 'connection' && (
            <>
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold">Select Connection</h1>
                <p className="text-base text-muted-foreground">Choose a database connection to use</p>
              </div>

              <div className="space-y-3">
                {connections.length > 0 ? (
                  connections.map((connection) => (
                    <Card
                      key={connection.uuid}
                      className="group cursor-pointer transition-all hover:border-primary hover:shadow-md"
                      onClick={() => handleSelectConnection(connection)}
                    >
                      <CardHeader className="flex flex-row items-center gap-4 p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                          <LanguageIcon language={connection.type} />
                        </div>
                        <div>
                          <CardTitle className="text-base group-hover:text-primary">{connection.name}</CardTitle>
                          <CardDescription className="text-sm">{connection.type}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                      <DatabaseIcon className="text-green-500" size="lg" />
                    </div>
                    <p className="mb-2 text-lg font-semibold">No connections available</p>
                    <p className="mb-4 text-sm text-muted-foreground">Create a connection to get started</p>
                    <Button onClick={() => navigate(ROUTES.TEAM_CONNECTIONS(teamUuid))} className="gap-2">
                      <DatabaseIcon size="sm" />
                      Add Connection
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Describe Your Spreadsheet */}
          {step === 'describe' && (
            <>
              {/* Onboarding: Combined File and Connection Selection */}
              {isFromOnboarding && (
                <>
                  <div className="mb-8 text-center">
                    <h1 className="mb-2 text-3xl font-bold">Ok, let's get started.</h1>
                    <p className="text-lg text-muted-foreground">What kind of data will you work with in Quadratic?</p>
                  </div>

                  {/* File import options */}
                  <div className="mb-6 space-y-3">
                    <h3 className="text-sm font-medium">Import a file</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          trackEvent('[StartWithAI].selectDataPath', { path: 'file', fileType: 'excel' });
                          navigate(ROUTES.CREATE_FILE(teamUuid, { private: isPrivate, openFileImport: true }));
                        }}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-all hover:border-primary hover:shadow-md"
                      >
                        <img src="/images/icon-excel.svg" alt="Excel" className="h-8 w-8" />
                        <span className="text-xs font-medium">Excel</span>
                      </button>

                      <button
                        onClick={() => {
                          trackEvent('[StartWithAI].selectDataPath', { path: 'file', fileType: 'csv' });
                          navigate(ROUTES.CREATE_FILE(teamUuid, { private: isPrivate, openFileImport: true }));
                        }}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-all hover:border-primary hover:shadow-md"
                      >
                        <FileIcon size="md" className="text-green-600" />
                        <span className="text-xs font-medium">CSV</span>
                      </button>

                      <button
                        onClick={() => {
                          trackEvent('[StartWithAI].selectDataPath', { path: 'file', fileType: 'pdf' });
                          navigate(ROUTES.CREATE_FILE(teamUuid, { private: isPrivate, openFileImport: true }));
                        }}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-all hover:border-primary hover:shadow-md"
                      >
                        <img src="/images/icon-pdf.svg" alt="PDF" className="h-8 w-8" />
                        <span className="text-xs font-medium">PDF</span>
                      </button>

                      <button
                        onClick={() => {
                          trackEvent('[StartWithAI].selectDataPath', { path: 'file', fileType: 'parquet' });
                          navigate(ROUTES.CREATE_FILE(teamUuid, { private: isPrivate, openFileImport: true }));
                        }}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-all hover:border-primary hover:shadow-md"
                      >
                        <FileIcon size="md" className="text-orange-500" />
                        <span className="text-xs font-medium">Parquet</span>
                      </button>
                    </div>
                  </div>

                  {/* Connection options */}
                  <div className="mb-6 space-y-3">
                    <h3 className="text-sm font-medium">Connect to a data source</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        Object.entries(connectionsByType) as [
                          ConnectionType,
                          (typeof connectionsByType)[ConnectionType],
                        ][]
                      ).map(([type, { name, Logo }]) => (
                        <button
                          key={type}
                          onClick={() => {
                            trackEvent('[StartWithAI].selectDataPath', { path: 'connection', connectionType: type });
                            handleOpenConnectionsDialog('new', type);
                          }}
                          className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-all hover:border-primary hover:shadow-md"
                        >
                          <div className="flex h-8 w-full items-center justify-center">
                            <Logo className="h-full max-h-8 w-auto max-w-[80px]" />
                          </div>
                          <span className="text-xs font-medium">{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        trackEvent('[StartWithAI].selectDataPath', { path: 'skip' });
                        navigate(ROUTES.CREATE_FILE(teamUuid, { private: isPrivate }));
                      }}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      I'm not ready to add a file or connection. Take me to the spreadsheet.
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Default view for non-onboarding users */}
              {!isFromOnboarding && (
                <>
                  <div className="mb-6 text-center">
                    <h1 className="mb-2 text-3xl font-bold">Start with AI</h1>
                    <p className="text-base text-muted-foreground">Let's build your spreadsheet.</p>
                  </div>

                  {/* Data section */}
                  <div className="mb-6 space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Add your data</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="h-10 gap-2 px-4"
                        onClick={() => handleFileUpload([...FILE_TYPES, ...PDF_TYPES], false)}
                      >
                        <img src="/images/icon-excel.svg" alt="Excel" className="h-5 w-5" />
                        Import Excel
                      </Button>

                      <Button
                        variant="outline"
                        className="h-10 gap-2 px-4"
                        onClick={() => handleFileUpload([...FILE_TYPES, ...PDF_TYPES], false)}
                      >
                        <img src="/images/icon-pdf.svg" alt="PDF" className="h-5 w-5" />
                        Import PDF
                      </Button>

                      <Button
                        variant="outline"
                        className="h-10 gap-2 px-4"
                        onClick={() => handleFileUpload([...FILE_TYPES, ...PDF_TYPES], false)}
                      >
                        <FileIcon size="sm" />
                        Import CSV / Others
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-10 gap-2 px-4">
                            <DatabaseIcon size="sm" />
                            Add connection
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Connections</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenConnectionsDialog('new')} className="gap-4">
                            <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">Add connection</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenConnectionsDialog()} className="gap-4">
                            <SettingsIcon className="flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">Manage connections</span>
                          </DropdownMenuItem>
                          {latestConnections.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {latestConnections.map((connection) => (
                                <DropdownMenuItem
                                  key={connection.uuid}
                                  onClick={() => {
                                    trackEvent('[StartWithAI].addConnection', {
                                      connectionType: connection.type,
                                    });
                                    setSelectedConnection({
                                      uuid: connection.uuid,
                                      name: connection.name,
                                      type: connection.type,
                                    });
                                  }}
                                  className="gap-4"
                                >
                                  <LanguageIcon language={connection.type} className="flex-shrink-0" />
                                  <span className="truncate">{connection.name}</span>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Uploaded files and selected connection pills */}
                  {(uploadedFiles.length > 0 || selectedConnection) && (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">Selected:</span>
                      {uploadedFiles.map((file, index) => {
                        const ext = file.name.toLowerCase();
                        const isExcel = ext.endsWith('.xlsx') || ext.endsWith('.xls');
                        const isPdf = ext.endsWith('.pdf');
                        return (
                          <div key={index} className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm">
                            {isExcel ? (
                              <img src="/images/icon-excel.svg" alt="Excel" className="h-4 w-4" />
                            ) : isPdf ? (
                              <img src="/images/icon-pdf.svg" alt="PDF" className="h-4 w-4" />
                            ) : (
                              <FileIcon size="sm" />
                            )}
                            <span className="max-w-32 truncate">{file.name}</span>
                            <button
                              onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}
                              className="ml-1 text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      {selectedConnection && (
                        <div className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm">
                          <LanguageIcon language={selectedConnection.type} />
                          <span className="max-w-32 truncate">{selectedConnection.name}</span>
                          <button
                            onClick={() => setSelectedConnection(null)}
                            className="ml-1 text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggestions - above the chat */}
                  <div className="mb-6 space-y-2">
                    {location.pathname === ROUTES.TEAM_FILES_CREATE_AI_WEB(teamUuid) ? (
                      <>
                        <h3 className="text-sm font-medium text-muted-foreground">Example searches</h3>
                        <div className="flex flex-col gap-2">
                          {WEB_SEARCH_EXAMPLES.map((query, index) => (
                            <button
                              key={index}
                              className="group flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-all hover:border-primary hover:shadow-md"
                              onClick={() => setPrompt(query)}
                            >
                              <SearchIcon size="sm" className="text-muted-foreground group-hover:text-primary" />
                              <span className="text-sm group-hover:text-primary">{query}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            {uploadedFiles.length > 0 || selectedConnection
                              ? 'Suggestions based on your data'
                              : 'Suggested prompts'}
                          </h3>
                          {isLoadingSuggestions && (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {isLoadingSuggestions
                            ? Array.from({ length: 3 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="animate-pulse rounded-lg border border-border bg-background p-4"
                                >
                                  <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                                  <div className="h-3 w-full rounded bg-muted" />
                                </div>
                              ))
                            : suggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  className="group rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-primary hover:shadow-md"
                                  onClick={() => setPrompt(suggestion.prompt)}
                                >
                                  <h3 className="mb-1 text-sm font-semibold group-hover:text-primary">
                                    {suggestion.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                                </button>
                              ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Chat box */}
                  <div>
                    <div className="rounded-lg border border-border bg-background shadow-lg has-[textarea:focus]:border-primary">
                      <Textarea
                        ref={promptTextareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="I want to create a spreadsheet that..."
                        className="min-h-32 resize-none rounded-lg border-0 p-4 text-base shadow-none focus-visible:ring-0"
                      />

                      <div className="flex items-center justify-end px-4 py-3">
                        <Button
                          onClick={handleBuildSpreadsheet}
                          disabled={!prompt.trim() || isSubmitting}
                          className="gap-2"
                        >
                          {isSubmitting ? 'Creating...' : 'Create'}
                          <ArrowRightIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <a
                        href={ROUTES.CREATE_FILE(teamUuid, { private: isPrivate })}
                        className="text-sm"
                        onClick={() => trackEvent('[StartWithAI].skip')}
                      >
                        Skip and open the spreadsheet →
                      </a>
                    </div>
                  </div>

                  {/* Spacer to reduce scroll jumping during generation */}
                  <div className="h-24" />
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Connections Dialog */}
      <Dialog open={showConnectionsDialog} onOpenChange={handleConnectionsDialogChange}>
        <DialogContent
          className="max-w-4xl"
          onPointerDownOutside={(event) => {
            event.preventDefault();
          }}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1">Manage team connections</DialogTitle>
          </DialogHeader>
          {showConnectionsDialog && (
            <Connections
              connections={latestConnections}
              connectionsAreLoading={connectionsFetcher.state === 'loading'}
              teamUuid={teamUuid}
              sshPublicKey={sshPublicKey}
              staticIps={staticIps}
              hideSidebar
              initialView={connectionsDialogInitialView}
              initialConnectionType={connectionsDialogInitialType}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
