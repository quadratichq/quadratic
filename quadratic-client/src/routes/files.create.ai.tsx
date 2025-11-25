import { uploadFile } from '@/app/helpers/files';
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
import { ArrowRightIcon, CheckIcon, ChevronLeftIcon, Pencil1Icon, ReloadIcon, UploadIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useNavigate } from 'react-router';

type ViewState =
  | 'selection' // Initial selection screen
  | 'file-upload' // Full screen file upload
  | 'pdf-upload' // Full screen PDF upload
  | 'outline' // AI Chat with attachments
  | 'connection-focused' // Connection picker prominently displayed
  | 'plan-review'; // Review and edit generated plan

type EntrySource = 'file' | 'prompt' | 'pdf' | 'connection' | 'web-research';

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

const FILE_TYPES = ['.csv', '.xlsx', '.parquet'];
const PDF_TYPES = ['.pdf'];

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

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);
  const teamData = await apiClient.teams.get(activeTeamUuid);

  return {
    connections: teamData.connections,
    teamUuid: teamData.team.uuid,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections, teamUuid } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewState>('selection');
  const [entrySource, setEntrySource] = useState<EntrySource | null>(null);
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

  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const executeButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  // Auto-resize plan textarea to fit content
  useEffect(() => {
    if (planTextareaRef.current && generatedPlan) {
      planTextareaRef.current.style.height = 'auto';
      planTextareaRef.current.style.height = `${planTextareaRef.current.scrollHeight}px`;
    }
  }, [generatedPlan]);

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
              files: uploadedFiles.map((f) => ({ name: f.name, type: f.type })),
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
    if (view !== 'plan-review') return;

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
  }, [view, generatedPlan, isGeneratingPlan]);

  const handleSelectOption = (option: EntrySource) => {
    setEntrySource(option);
    switch (option) {
      case 'file':
        setView('file-upload');
        break;
      case 'prompt':
        setView('outline');
        break;
      case 'pdf':
        setView('pdf-upload');
        break;
      case 'connection':
        setView('connection-focused');
        break;
      case 'web-research':
        setView('outline');
        break;
    }
  };

  const handleBack = () => {
    if (view === 'plan-review') {
      setView('outline');
      setGeneratedPlan('');
      setPlanError(null);
    } else if (view === 'outline' && entrySource !== 'prompt' && entrySource !== 'web-research') {
      if (entrySource === 'file') setView('file-upload');
      else if (entrySource === 'pdf') setView('pdf-upload');
      else if (entrySource === 'connection') setView('connection-focused');
    } else {
      setView('selection');
      setEntrySource(null);
      setUploadedFiles([]);
      setSelectedConnection(null);
      setPrompt('');
      setGeneratedPlan('');
      setPlanError(null);
    }
  };

  const handleFileUpload = async (fileTypes: string[]) => {
    const files = await uploadFile(fileTypes);
    if (files.length > 0) {
      const newFiles: UploadedFile[] = [];
      for (const file of files) {
        const data = await file.arrayBuffer();
        newFiles.push({
          name: file.name,
          size: file.size,
          data,
          type: file.type,
        });
      }
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setView('outline');
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, acceptedTypes: string[]) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedTypes.includes(ext);
    });

    if (files.length > 0) {
      const newFiles: UploadedFile[] = [];
      for (const file of files) {
        const data = await file.arrayBuffer();
        newFiles.push({
          name: file.name,
          size: file.size,
          data,
          type: file.type,
        });
      }
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setView('outline');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectConnection = (connection: (typeof connections)[0]) => {
    setSelectedConnection({
      uuid: connection.uuid,
      name: connection.name,
      type: connection.type,
    });
    if (view === 'connection-focused') {
      setView('outline');
    }
  };

  const generatePlan = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      setIsGeneratingPlan(true);
      setPlanError(null);
      setGeneratedPlan('');
      setView('plan-review');

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

  const handleExecutePlan = () => {
    if (!generatedPlan.trim()) return;

    navigate(
      ROUTES.CREATE_FILE(teamUuid, {
        prompt: generatedPlan,
        private: true,
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

  const dataSourceOptions = [
    {
      id: 'file' as EntrySource,
      title: 'File',
      description: `Upload a file with your data`,
      icon: FileIcon,
      badge: FILE_TYPES.join(', '),
      gradient: 'from-blue-500 to-cyan-600',
      featured: false,
    },
    {
      id: 'prompt' as EntrySource,
      title: 'Generate from prompt',
      description: 'Create a spreadsheet starting from a prompt',
      icon: StarShineIcon,
      gradient: 'from-purple-500 to-pink-600',
      featured: true,
      recommended: true,
    },
    {
      id: 'pdf' as EntrySource,
      title: 'PDF',
      description: 'Extract structured data from PDF documents',
      icon: PDFIcon,
      gradient: 'from-red-500 to-orange-600',
      featured: false,
    },
    {
      id: 'connection' as EntrySource,
      title: 'Connection',
      description:
        connections.length > 0
          ? `Use one of your ${connections.length} connection${connections.length !== 1 ? 's' : ''}`
          : 'Connect to a database',
      icon: DatabaseIcon,
      badge: connections.length > 0 ? `${connections.length} available` : undefined,
      gradient: 'from-green-500 to-emerald-600',
      featured: false,
    },
    {
      id: 'web-research' as EntrySource,
      title: 'Web Research',
      description: 'Let AI search the web and gather data',
      icon: SearchIcon,
      gradient: 'from-indigo-500 to-blue-600',
      featured: false,
    },
  ];

  // Selection View
  if (view === 'selection') {
    return (
      <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
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

        <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-3xl font-bold">Start with AI</h1>
              <p className="text-base text-muted-foreground">What data would you like to start with?</p>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-3">
              {dataSourceOptions.slice(0, 3).map((option) => (
                <Card
                  key={option.id}
                  className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => handleSelectOption(option.id)}
                >
                  <div
                    className={`relative flex items-center justify-center bg-gradient-to-br ${option.gradient} ${
                      option.featured ? 'h-36' : 'h-28'
                    }`}
                  >
                    {option.recommended && (
                      <span className="absolute right-3 top-3 rounded-md bg-green-500 px-2 py-1 text-xs font-semibold uppercase text-white">
                        Recommended
                      </span>
                    )}
                    <option.icon className="text-white" size={option.featured ? '2xl' : 'lg'} />
                  </div>
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <CardTitle className={`group-hover:text-primary ${option.featured ? 'text-lg' : 'text-base'}`}>
                        {option.title}
                      </CardTitle>
                      {option.badge && (
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs">{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="flex justify-center gap-4">
              {dataSourceOptions.slice(3).map((option) => (
                <Card
                  key={option.id}
                  className="group w-full max-w-[calc(33.333%-0.67rem)] cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                  onClick={() => handleSelectOption(option.id)}
                >
                  <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${option.gradient}`}>
                    <option.icon className="text-white" size="lg" />
                  </div>
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base group-hover:text-primary">{option.title}</CardTitle>
                      {option.badge && (
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs">{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // File Upload View
  if (view === 'file-upload') {
    return (
      <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <button
          onClick={handleBack}
          className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <main className="flex flex-1 items-center justify-center p-6">
          <div
            className={cn(
              'flex h-96 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all',
              dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background/50'
            )}
            onDrop={(e) => handleDrop(e, FILE_TYPES)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <UploadIcon className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Drop your files here</h2>
            <p className="mb-6 text-muted-foreground">or click to browse</p>
            <Button onClick={() => handleFileUpload(FILE_TYPES)} size="lg">
              Choose Files
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">Supported: {FILE_TYPES.join(', ')}</p>
          </div>
        </main>
      </div>
    );
  }

  // PDF Upload View
  if (view === 'pdf-upload') {
    return (
      <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <button
          onClick={handleBack}
          className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <main className="flex flex-1 items-center justify-center p-6">
          <div
            className={cn(
              'flex h-96 w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all',
              dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background/50'
            )}
            onDrop={(e) => handleDrop(e, PDF_TYPES)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <PDFIcon className="mb-4 text-muted-foreground" size="2xl" />
            <h2 className="mb-2 text-xl font-semibold">Drop your PDF here</h2>
            <p className="mb-6 text-muted-foreground">or click to browse</p>
            <Button onClick={() => handleFileUpload(PDF_TYPES)} size="lg">
              Choose PDF
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">Supported: PDF files</p>
          </div>
        </main>
      </div>
    );
  }

  // Connection Focused View
  if (view === 'connection-focused') {
    return (
      <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <button
          onClick={handleBack}
          className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
          <div className="w-full max-w-3xl">
            <div className="mb-8 text-center">
              <h1 className="mb-3 text-3xl font-bold">Choose a Connection</h1>
              <p className="text-base text-muted-foreground">
                {connections.length > 0
                  ? 'Select a connection to query data from'
                  : 'Create a connection to get started'}
              </p>
            </div>

            {connections.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {connections.map((connection) => (
                  <Card
                    key={connection.uuid}
                    className={cn(
                      'group cursor-pointer transition-all hover:border-primary hover:shadow-md',
                      selectedConnection?.uuid === connection.uuid && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => handleSelectConnection(connection)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <LanguageIcon language={connection.type} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base group-hover:text-primary">
                            {connection.name}
                          </CardTitle>
                          <CardDescription className="text-xs">{connection.type}</CardDescription>
                        </div>
                        {selectedConnection?.uuid === connection.uuid && <CheckIcon className="h-5 w-5 text-primary" />}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <DatabaseIcon className="mx-auto mb-4 text-muted-foreground" size="2xl" />
                <p className="mb-6 text-muted-foreground">No connections yet</p>
                <Button asChild>
                  <Link to={ROUTES.TEAM_CONNECTIONS(teamUuid)} className="inline-flex items-center gap-2">
                    Add a Connection
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Plan Review View
  if (view === 'plan-review') {
    return (
      <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <button
          onClick={handleBack}
          className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <main className="flex flex-1 flex-col items-center overflow-auto p-6 pt-20">
          <div className="w-full max-w-3xl">
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-3xl font-bold">Review Your Plan</h1>
              <p className="text-muted-foreground">
                {isGeneratingPlan
                  ? 'AI is generating a plan for your spreadsheet...'
                  : 'Edit the plan below, then click Build Spreadsheet'}
              </p>
            </div>

            <div className="mb-4 rounded-lg bg-accent/50 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Pencil1Icon className="h-4 w-4" />
                Your request
              </div>
              <p className="text-sm">{prompt}</p>
            </div>

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

            <div className="rounded-xl border border-border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-medium">Generated Plan</span>
                {!isGeneratingPlan && generatedPlan && (
                  <Button variant="ghost" size="sm" onClick={handleRegeneratePlan} className="gap-2">
                    <ReloadIcon className="h-4 w-4" />
                    Regenerate
                  </Button>
                )}
              </div>

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
                  {isGeneratingPlan ? 'Please wait...' : 'Edit the plan above, then build when ready'}
                </p>
                <Button
                  ref={executeButtonRef}
                  onClick={handleExecutePlan}
                  disabled={!generatedPlan.trim() || isGeneratingPlan}
                  className="gap-2"
                >
                  <ArrowRightIcon className="h-4 w-4" />
                  Build Spreadsheet
                </Button>
              </div>
            </div>
          </div>
        </main>

        {showFloatingExecute && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
              <p className="text-sm text-muted-foreground">Ready to create your spreadsheet?</p>
              <Button onClick={handleExecutePlan} className="gap-2">
                <ArrowRightIcon className="h-4 w-4" />
                Build Spreadsheet
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Outline View (default)
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      <button
        onClick={handleBack}
        className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      <main className="flex flex-1 flex-col items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-3xl font-bold">Describe Your Spreadsheet</h1>
            <p className="text-base text-muted-foreground">Tell us what you want to create</p>
          </div>

          {(uploadedFiles.length > 0 || selectedConnection) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
                  <FileIcon size="sm" />
                  <span className="max-w-32 truncate">{file.name}</span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ))}
              {selectedConnection && (
                <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
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

          <div className="mb-6 rounded-xl border border-border bg-background shadow-lg">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what spreadsheet you want to create..."
              className="min-h-32 resize-none rounded-t-xl border-0 p-4 text-base shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <AttachFileIcon size="sm" />
                      Attach
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Add Context</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleFileUpload(FILE_TYPES)}>
                      <FileIcon size="sm" className="mr-2" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleFileUpload(PDF_TYPES)}>
                      <PDFIcon size="sm" className="mr-2" />
                      Upload PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <DatabaseIcon size="sm" />
                      Connection
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Select Connection</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {connections.length > 0 ? (
                      connections.map((connection) => (
                        <DropdownMenuItem key={connection.uuid} onClick={() => handleSelectConnection(connection)}>
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

              <Button onClick={handleGeneratePlan} disabled={!prompt.trim()} className="gap-2">
                <ArrowRightIcon className="h-4 w-4" />
                Generate Plan
              </Button>
            </div>
          </div>

          <div className="space-y-3">
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
                      <h3 className="mb-1 text-sm font-semibold group-hover:text-primary">{suggestion.title}</h3>
                      <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                    </button>
                  ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
