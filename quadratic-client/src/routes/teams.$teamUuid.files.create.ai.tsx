import { aiChatFilesDirect } from '@/app/ai/aiChatFilesDirect';
import { getExtension, uploadFile } from '@/app/helpers/files';
import { authClient, requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { AttachFileIcon, DatabaseIcon, FileIcon, PDFIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
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
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ArrowRightIcon, Cross2Icon, UploadIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, redirect, useLoaderData, useNavigate, useSearchParams } from 'react-router';

interface UploadedFile {
  name: string;
  size: number;
  data: ArrayBuffer;
  type: string;
}

interface SelectedConnection {
  uuid: string;
  name: string;
  type: string;
}

interface SuggestedPrompt {
  title: string;
  description: string;
  prompt: string;
}

const FILE_TYPES = ['.csv', '.xlsx', '.xls', '.parquet', '.parq', '.pqt'];
const PDF_TYPES = ['.pdf'];
const ALL_FILE_TYPES = [...FILE_TYPES, ...PDF_TYPES];

const DEFAULT_SUGGESTIONS: SuggestedPrompt[] = [
  {
    title: 'Financial Modeling',
    description: 'Build models for forecasting and analysis',
    prompt: 'Create a financial model with revenue projections, expense forecasting, and scenario analysis',
  },
  {
    title: 'Supply Chain',
    description: 'Track inventory and logistics',
    prompt: 'Create a supply chain dashboard to track inventory levels, supplier performance, and delivery timelines',
  },
  {
    title: 'Trading',
    description: 'Analyze markets and portfolios',
    prompt: 'Create a trading analysis spreadsheet with portfolio tracking, market data, and performance metrics',
  },
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

  return {
    connections: teamData.connections,
    teamUuid: teamData.team.uuid,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections, teamUuid } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isPrivate = searchParams.get('private') === 'true';

  // Track page load
  useEffect(() => {
    trackEvent('[StartWithAI].loaded', { step: 'prompt' });
  }, []);

  const [prompt, setPrompt] = useState(DEFAULT_SUGGESTIONS[0].prompt);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<SelectedConnection | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[]>(DEFAULT_SUGGESTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);

  // Focus prompt textarea on mount
  useEffect(() => {
    setTimeout(() => {
      promptTextareaRef.current?.focus();
    }, 100);
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

  const handleFileUpload = async (fileTypes: string[]) => {
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
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);

    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles) return;

    // Filter files by extension or mime type
    const supportedFiles = Array.from(droppedFiles).filter((file) => {
      const ext = `.${getExtension(file.name).toLowerCase()}`;
      return file.type.startsWith('image/') || ALL_FILE_TYPES.includes(ext) || ALL_FILE_TYPES.includes(file.type);
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
      setUploadedFiles((prev) => [...prev, ...newFiles]);
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

  const handleSubmit = useCallback(
    async (promptText: string) => {
      if (!promptText.trim() || isSubmitting) return;

      trackEvent('[StartWithAI].submit', {
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
        })
      );
    },
    [isSubmitting, uploadedFiles, selectedConnection, isPrivate, navigate, teamUuid]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(prompt);
    }
  };

  const handleSuggestionClick = (suggestion: SuggestedPrompt) => {
    trackEvent('[StartWithAI].selectSuggestion', { promptLength: suggestion.prompt.length });
    setPrompt(suggestion.prompt);
    // Focus the textarea so user can edit or submit
    promptTextareaRef.current?.focus();
  };

  const hasContext = uploadedFiles.length > 0 || selectedConnection;

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.15), transparent),
          radial-gradient(ellipse 60% 40% at 100% 50%, rgba(255, 107, 107, 0.08), transparent),
          radial-gradient(ellipse 60% 40% at 0% 80%, rgba(79, 172, 254, 0.08), transparent),
          linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
        `,
      }}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Animated floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-32 top-1/4 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            animation: 'float 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -right-32 top-2/3 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            animation: 'float 25s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-[#7877c6] bg-background px-16 py-12 shadow-2xl">
            <div className="rounded-md bg-[#7877c6]/10 p-4">
              <UploadIcon className="h-12 w-12 text-[#7877c6]" />
            </div>
            <p className="text-xl font-semibold">Drop files here</p>
            <p className="text-sm text-muted-foreground">CSV, Excel, Parquet, or PDF</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background/80 text-foreground backdrop-blur-sm transition-all hover:border-[#7877c6] hover:bg-background"
              >
                <QuadraticLogo />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Back to Dashboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-2xl">
          {/* Hero section */}
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
              Describe the spreadsheet you want to create
            </h1>
          </div>

          {/* Context chips - files and connections */}
          {hasContext && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="group flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-1.5 text-sm backdrop-blur-sm transition-all hover:border-[#7877c6]"
                >
                  {file.name.endsWith('.pdf') ? (
                    <PDFIcon size="sm" className="text-red-400" />
                  ) : (
                    <FileIcon size="sm" className="text-blue-400" />
                  )}
                  <span className="max-w-40 truncate">{file.name}</span>
                  <button
                    onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <Cross2Icon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {selectedConnection && (
                <div className="group flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-1.5 text-sm backdrop-blur-sm transition-all hover:border-[#7877c6]">
                  <LanguageIcon language={selectedConnection.type} />
                  <span className="max-w-40 truncate">{selectedConnection.name}</span>
                  <button
                    onClick={() => setSelectedConnection(null)}
                    className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <Cross2Icon className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Main prompt input */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border bg-background transition-all duration-300',
              'border-border shadow-lg',
              'focus-within:border-border focus-within:shadow-xl'
            )}
          >
            <Textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-24 resize-none !border-none bg-transparent px-6 py-5 text-lg !shadow-none focus-visible:ring-0"
              disabled={isSubmitting}
            />

            {/* Input actions */}
            <div className="flex items-center justify-between px-5 pb-5 pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9 gap-2 rounded-md border-border px-4 text-foreground"
                  onClick={() => handleFileUpload(ALL_FILE_TYPES)}
                  disabled={isSubmitting}
                >
                  <AttachFileIcon size="sm" />
                  <span>Import file (CSV, XLSX, PDF)</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 gap-2 rounded-md border-border px-4 text-foreground"
                      disabled={isSubmitting}
                    >
                      <DatabaseIcon size="sm" />
                      <span className="hidden sm:inline">Add connection</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Select Connection</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {connections.length > 0 ? (
                      connections.map((connection) => (
                        <DropdownMenuItem
                          key={connection.uuid}
                          onClick={() => {
                            trackEvent('[StartWithAI].addConnection', { connectionType: connection.type });
                            setSelectedConnection({
                              uuid: connection.uuid,
                              name: connection.name,
                              type: connection.type,
                            });
                          }}
                        >
                          <LanguageIcon language={connection.type} className="mr-2" />
                          {connection.name}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link to={ROUTES.TEAM_CONNECTIONS(teamUuid)} className="gap-2">
                          <DatabaseIcon size="sm" />
                          Create connection
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Button
                onClick={() => handleSubmit(prompt)}
                disabled={!prompt.trim() || isSubmitting}
                className="h-9 gap-2 rounded-md bg-foreground px-5 text-background hover:bg-foreground/90"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-10">
            <div className="mb-5 flex items-center gap-2">
              <h3 className="text-base font-medium text-foreground">
                {hasContext ? 'Suggestions based on your data' : 'Or explore some common use-cases for Quadratic'}
              </h3>
              {isLoadingSuggestions && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#7877c6] border-t-transparent" />
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {isLoadingSuggestions
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-md border border-border bg-background/50 p-4"
                    >
                      <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                    </div>
                  ))
                : suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="group relative overflow-hidden rounded-md border border-border bg-background/50 p-4 text-left backdrop-blur-sm transition-all hover:border-[#7877c6] hover:bg-background"
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isSubmitting}
                    >
                      {/* Hover gradient */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.02) 100%)',
                        }}
                      />
                      <h4 className="relative mb-1 text-sm font-semibold transition-colors group-hover:text-foreground">
                        {suggestion.title}
                      </h4>
                      <p className="relative text-xs text-muted-foreground">{suggestion.description}</p>
                    </button>
                  ))}
            </div>
          </div>
        </div>
      </main>

      {/* CSS Animation for floating orbs */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(0) translateX(20px); }
          75% { transform: translateY(20px) translateX(10px); }
        }
      `}</style>
    </div>
  );
};
