import { aiChatFilesDirect } from '@/app/ai/aiChatFilesDirect';
import { getExtension, uploadFile } from '@/app/helpers/files';
import { authClient, requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { AttachFileIcon, DatabaseIcon, FileIcon, PDFIcon, SearchIcon, StarShineIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
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
import { ArrowRightIcon, ChevronLeftIcon, ReloadIcon, UploadIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useLocation, useNavigate, useSearchParams } from 'react-router';

type Step = 'data' | 'file-import' | 'pdf-import' | 'connection' | 'describe';

const getStepFromPath = (pathname: string, teamUuid: string): Step => {
  if (pathname === ROUTES.TEAM_FILES_CREATE_AI_FILE(teamUuid)) return 'file-import';
  if (pathname === ROUTES.TEAM_FILES_CREATE_AI_PDF(teamUuid)) return 'pdf-import';
  if (pathname === ROUTES.TEAM_FILES_CREATE_AI_CONNECTION(teamUuid)) return 'connection';
  if (
    pathname === ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid) ||
    pathname === ROUTES.TEAM_FILES_CREATE_AI_WEB(teamUuid)
  )
    return 'describe';
  return 'data';
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
  type: string;
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
    title: 'Sales Dashboard',
    description: 'Track revenue metrics and trends',
    prompt: 'Create a sales dashboard with monthly revenue, top products, and growth trends',
  },
  {
    title: 'Budget Tracker',
    description: 'Manage expenses and income',
    prompt: 'Create a personal budget tracker with expense categories, income tracking, and savings goals',
  },
  {
    title: 'Project Timeline',
    description: 'Plan tasks and milestones',
    prompt: 'Create a project timeline with tasks, deadlines, and milestone tracking',
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

  return {
    connections: teamData.connections,
    teamUuid: teamData.team.uuid,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections, teamUuid } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const step = getStepFromPath(location.pathname, teamUuid);
  const isPrivate = searchParams.get('private') === 'true';

  // Helper to preserve search params when navigating
  const getRouteWithParams = (route: string) => {
    return isPrivate ? `${route}?private=true` : route;
  };
  const [prompt, setPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<SelectedConnection | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showFloatingExecute, setShowFloatingExecute] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[]>(DEFAULT_SUGGESTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);

  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const executeButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);
  const lastGeneratedPromptRef = useRef<string>('');

  // Auto-resize plan textarea to fit content
  useEffect(() => {
    if (planTextareaRef.current && generatedPlan && step === 'describe') {
      // Use requestAnimationFrame to ensure DOM is ready after navigation
      requestAnimationFrame(() => {
        if (planTextareaRef.current) {
          planTextareaRef.current.style.height = 'auto';
          planTextareaRef.current.style.height = `${planTextareaRef.current.scrollHeight}px`;
        }
      });
    }
  }, [generatedPlan, step]);

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

  // Check if execute button is visible in viewport
  useEffect(() => {
    const checkButtonVisibility = () => {
      if (executeButtonRef.current) {
        const rect = executeButtonRef.current.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        setShowFloatingExecute(!isVisible && !!generatedPlan.trim() && !isGeneratingPlan);
      }
    };

    checkButtonVisibility();
    window.addEventListener('scroll', checkButtonVisibility, true);
    window.addEventListener('resize', checkButtonVisibility);

    return () => {
      window.removeEventListener('scroll', checkButtonVisibility, true);
      window.removeEventListener('resize', checkButtonVisibility);
    };
  }, [generatedPlan, isGeneratingPlan]);

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
    setSelectedConnection({
      uuid: connection.uuid,
      name: connection.name,
      type: connection.type,
    });
    navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)));
  };

  const generatePlan = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      lastGeneratedPromptRef.current = promptText;
      setIsEditingPrompt(false);
      setIsGeneratingPlan(true);
      setPlanError(null);
      setGeneratedPlan('');

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const token = await authClient.getTokenOrRedirect();
        const endpoint = `${apiClient.getApiUrl()}/v0/ai/plan`;

        const context: {
          files?: { name: string; type: string; content?: string }[];
          connectionName?: string;
          connectionType?: string;
        } = {};

        if (uploadedFiles.length > 0) {
          context.files = uploadedFiles.map((file) => {
            const isTextFile =
              file.type.startsWith('text/') ||
              file.type === 'application/json' ||
              file.type === 'application/csv' ||
              file.name.endsWith('.csv') ||
              file.name.endsWith('.json') ||
              file.name.endsWith('.txt') ||
              file.name.endsWith('.md') ||
              file.name.endsWith('.tsv');

            let content: string | undefined;
            if (isTextFile) {
              try {
                const decoder = new TextDecoder('utf-8');
                content = decoder.decode(file.data);
              } catch {
                // If decoding fails, skip content
              }
            }

            return { name: file.name, type: file.type, content };
          });
        }
        if (selectedConnection) {
          context.connectionName = selectedConnection.name;
          context.connectionType = selectedConnection.type;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          signal: abortControllerRef.current.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamUuid,
            prompt: promptText,
            context: Object.keys(context).length > 0 ? context : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  for (const content of data.content) {
                    if (content.type === 'text' && content.text) {
                      fullText = content.text;
                      setGeneratedPlan(fullText);
                    }
                  }
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error generating plan:', error);
        setPlanError(error instanceof Error ? error.message : 'Failed to generate plan');
      } finally {
        setIsGeneratingPlan(false);
      }
    },
    [teamUuid, uploadedFiles, selectedConnection]
  );

  const handleGeneratePlan = () => {
    if (!prompt.trim()) return;
    generatePlan(prompt);
  };

  const handleSubmitPrompt = useCallback(
    (promptText: string) => {
      setPrompt(promptText);
      generatePlan(promptText);
    },
    [generatePlan]
  );

  const handleExecutePlan = async () => {
    if (!generatedPlan.trim() || isExecuting) return;
    setIsExecuting(true);

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
        prompt: generatedPlan,
        private: isPrivate,
        chatId,
      })
    );
  };

  const handleRegeneratePlan = () => {
    generatePlan(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGeneratePlan();
    }
  };

  // Main View
  return (
    <div
      className="relative flex h-full flex-col bg-background"
      {...(step === 'data' && {
        onDrop: (e: DragEvent<HTMLDivElement>) => handleDrop(e, [...FILE_TYPES, ...PDF_TYPES]),
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
      })}
    >
      {/* Drag overlay - only show on data selection page */}
      {dragOver && step === 'data' && (
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

      {step === 'data' ? (
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
          {/* Step 1: Select Data */}
          {step === 'data' && (
            <>
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold">Start with AI</h1>
                <p className="text-base text-muted-foreground">Choose where your data comes from</p>
              </div>

              {/* Data source cards */}
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                {/* Start from Prompt - First with Recommended badge */}
                <Card
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(teamUuid)))}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600">
                    <StarShineIcon className="text-white" size="lg" />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm group-hover:text-primary">Generate from Prompt</CardTitle>
                    <CardDescription className="text-xs">Describe what you want</CardDescription>
                    <span className="mt-2 inline-block w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Recommended
                    </span>
                  </CardHeader>
                </Card>

                <Card
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_FILE(teamUuid)))}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-600">
                    <FileIcon className="text-white" size="lg" />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm group-hover:text-primary">Import File</CardTitle>
                    <CardDescription className="text-xs">{getFileTypeDisplay(FILE_TYPES)}</CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_PDF(teamUuid)))}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-red-500 to-orange-600">
                    <PDFIcon className="text-white" size="lg" />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm group-hover:text-primary">Import PDF</CardTitle>
                    <CardDescription className="text-xs">Extract data from PDFs</CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_CONNECTION(teamUuid)))}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600">
                    <DatabaseIcon className="text-white" size="lg" />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm group-hover:text-primary">Connection</CardTitle>
                    <CardDescription className="text-xs">
                      {connections.length > 0 ? `${connections.length} available` : 'Connect to database'}
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => navigate(getRouteWithParams(ROUTES.TEAM_FILES_CREATE_AI_WEB(teamUuid)))}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
                    <SearchIcon className="text-white" size="lg" />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm group-hover:text-primary">Web Research</CardTitle>
                    <CardDescription className="text-xs">AI searches the web</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </>
          )}

          {/* File Import Page */}
          {step === 'file-import' && (
            <>
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold">Import File</h1>
                <p className="text-base text-muted-foreground">Upload a file to get started</p>
              </div>

              <div
                className={cn(
                  'flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30 hover:border-primary hover:bg-muted/50'
                )}
                onClick={() => handleFileUpload(FILE_TYPES)}
                onDrop={(e) => handleDrop(e, FILE_TYPES)}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                  <UploadIcon className="h-8 w-8 text-blue-500" />
                </div>
                <p className="mb-2 text-lg font-semibold">Drop your file here</p>
                <p className="mb-4 text-sm text-muted-foreground">or click to browse</p>
                <p className="text-xs text-muted-foreground">Supported: {getFileTypeDisplay(FILE_TYPES)}</p>
              </div>
            </>
          )}

          {/* PDF Import Page */}
          {step === 'pdf-import' && (
            <>
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold">Import PDF</h1>
                <p className="text-base text-muted-foreground">Upload a PDF to extract data from</p>
              </div>

              <div
                className={cn(
                  'flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30 hover:border-primary hover:bg-muted/50'
                )}
                onClick={() => handleFileUpload(PDF_TYPES)}
                onDrop={(e) => handleDrop(e, PDF_TYPES)}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                  <PDFIcon className="text-red-500" size="lg" />
                </div>
                <p className="mb-2 text-lg font-semibold">Drop your PDF here</p>
                <p className="mb-4 text-sm text-muted-foreground">or click to browse</p>
                <p className="text-xs text-muted-foreground">Supported: .pdf</p>
              </div>
            </>
          )}

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
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold">Describe Your Spreadsheet</h1>
                <p className="text-base text-muted-foreground">What do you want to do?</p>
              </div>

              {/* Data section */}
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">Data</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm">
                      <FileIcon size="sm" />
                      <span className="max-w-32 truncate">{file.name}</span>
                      <button
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {selectedConnection && (
                    <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm">
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

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleFileUpload([...FILE_TYPES, ...PDF_TYPES], false)}
                  >
                    <AttachFileIcon size="sm" />
                    Add file
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <DatabaseIcon size="sm" />
                        Add connection
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Select Connection</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {connections.length > 0 ? (
                        connections.map((connection) => (
                          <DropdownMenuItem
                            key={connection.uuid}
                            onClick={() => {
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
                          <Link to={ROUTES.TEAM_CONNECTIONS(teamUuid)} className="gap-4">
                            Add Connection
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Suggestions - above the chat */}
              <div className="mb-4 space-y-1">
                {location.pathname === ROUTES.TEAM_FILES_CREATE_AI_WEB(teamUuid) ? (
                  <>
                    <h3 className="text-sm font-medium text-muted-foreground">Example searches</h3>
                    <div className="flex flex-col gap-2">
                      {WEB_SEARCH_EXAMPLES.map((query, index) => (
                        <button
                          key={index}
                          className="group flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-all hover:border-primary hover:shadow-md"
                          onClick={() => handleSubmitPrompt(query)}
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
                          : 'Popular templates'}
                      </h3>
                      {isLoadingSuggestions && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {isLoadingSuggestions
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-lg border border-border bg-background p-4">
                              <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                              <div className="h-3 w-full rounded bg-muted" />
                            </div>
                          ))
                        : suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              className="group rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-primary hover:shadow-md"
                              onClick={() => handleSubmitPrompt(suggestion.prompt)}
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
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">Prompt</h3>
                <div
                  className={cn(
                    'rounded-xl border border-border bg-background',
                    (isGeneratingPlan || generatedPlan) && !isEditingPrompt ? 'rounded-b-xl shadow-none' : 'shadow-lg'
                  )}
                >
                  <Textarea
                    ref={promptTextareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => (isGeneratingPlan || generatedPlan) && setIsEditingPrompt(true)}
                    onBlur={() => {
                      if (prompt === lastGeneratedPromptRef.current) {
                        setIsEditingPrompt(false);
                      }
                    }}
                    placeholder="I want to create a spreadsheet that..."
                    className={cn(
                      'resize-none border-0 p-4 text-base shadow-none focus-visible:ring-0',
                      (isGeneratingPlan || generatedPlan) && !isEditingPrompt
                        ? 'min-h-16 rounded-xl'
                        : 'min-h-32 rounded-t-xl',
                      generatedPlan && !isEditingPrompt && 'cursor-pointer'
                    )}
                  />

                  {/* Actions footer - hide when plan exists and not editing */}
                  {(!isGeneratingPlan && !generatedPlan) || isEditingPrompt ? (
                    <div className="flex items-center justify-end border-t border-border px-4 py-3">
                      {!isGeneratingPlan && !generatedPlan ? (
                        <Button onClick={handleGeneratePlan} disabled={!prompt.trim()} className="gap-2">
                          Generate Plan
                          <ArrowRightIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setIsEditingPrompt(false);
                            handleGeneratePlan();
                          }}
                          disabled={!prompt.trim() || prompt === lastGeneratedPromptRef.current}
                          className="gap-2"
                        >
                          <ReloadIcon className="h-4 w-4" />
                          Regenerate Plan
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Generated Plan Section */}
              {(isGeneratingPlan || generatedPlan || planError) && (
                <div className="mt-6 space-y-1">
                  {planError && (
                    <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                      <p className="text-sm font-medium">Error generating plan</p>
                      <p className="text-sm">{planError}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleRegeneratePlan}>
                        <ReloadIcon className="mr-2 h-4 w-4" />
                        Try Again
                      </Button>
                    </div>
                  )}

                  <h3 className="text-sm font-medium text-muted-foreground">Generated Plan</h3>
                  <div className="rounded-xl border border-border bg-background shadow-lg">
                    {isGeneratingPlan && !generatedPlan ? (
                      <div className="flex min-h-64 items-center justify-center p-6">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                          <p className="text-sm text-muted-foreground">Generating plan...</p>
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        ref={planTextareaRef}
                        value={generatedPlan}
                        onChange={(e) => setGeneratedPlan(e.target.value)}
                        placeholder="Your plan will appear here..."
                        className="min-h-32 resize-none overflow-hidden rounded-none border-0 bg-transparent p-4 text-sm shadow-none focus-visible:ring-0"
                        style={{ height: 'auto' }}
                        disabled={isGeneratingPlan}
                      />
                    )}

                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {isGeneratingPlan ? 'Please wait...' : 'Ready to create your spreadsheet?'}
                      </p>
                      <Button
                        ref={executeButtonRef}
                        onClick={handleExecutePlan}
                        disabled={!generatedPlan.trim() || isGeneratingPlan || isExecuting}
                        className="gap-2"
                      >
                        Build Spreadsheet
                        <ArrowRightIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Spacer to reduce scroll jumping during generation */}
              <div className="h-24" />
            </>
          )}
        </div>
      </main>

      {showFloatingExecute && step === 'describe' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <p className="text-sm text-muted-foreground">Ready to create your spreadsheet?</p>
            <Button onClick={handleExecutePlan} disabled={isExecuting} className="gap-2">
              Build Spreadsheet
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
