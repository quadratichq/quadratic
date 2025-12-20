import {
  type EmptyChatPromptSuggestions,
  useGetEmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import {
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { fullScreenChatIsOpenAtom } from '@/app/atoms/fullScreenChatAtom';
import { events } from '@/app/events/events';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { AIIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const EXAMPLE_PROMPTS = [
  {
    label: 'Analyze my data',
    prompt: 'Help me analyze the data on this sheet and provide insights.',
  },
  {
    label: 'Create a chart',
    prompt: 'Create a chart from the data. If there is no data, add sample sales data and create a bar chart.',
  },
  {
    label: 'Build a dashboard',
    prompt: 'Help me build a dashboard with key metrics and visualizations.',
  },
  {
    label: 'Import web data',
    prompt: 'Search the web for the latest stock prices of top 5 tech companies and add them to my sheet.',
  },
  {
    label: 'Write a formula',
    prompt: 'Help me write a formula to calculate the running total of values in a column.',
  },
  {
    label: 'Clean my data',
    prompt: 'Help me clean and format the data on this sheet, removing duplicates and standardizing formats.',
  },
];

export const AIFullScreenChat = memo(() => {
  const [isOpen, setIsOpen] = useRecoilState(fullScreenChatIsOpenAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusRef = useRef(true);

  // State for dynamic suggestions
  const [formFiles, setFormFiles] = useState<FileContent[]>([]);
  const [formImportFiles, setFormImportFiles] = useState<{ name: string; size: number }[]>([]);
  const [formContext, setFormContext] = useState<Context>({});
  const [dynamicSuggestions, setDynamicSuggestions] = useState<EmptyChatPromptSuggestions | undefined>(undefined);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  // Track if there's any data to generate contextual suggestions
  const hasFormData = formFiles.length > 0 || formImportFiles.length > 0 || formContext.connection !== undefined;

  // Listen for form state changes
  useEffect(() => {
    const handleFormStateChanged = (state: {
      files: FileContent[];
      importFiles: { name: string; size: number }[];
      context: Context;
    }) => {
      setFormFiles(state.files);
      setFormImportFiles(state.importFiles);
      setFormContext(state.context);
    };

    events.on('aiAnalystFormStateChanged', handleFormStateChanged);
    return () => {
      events.off('aiAnalystFormStateChanged', handleFormStateChanged);
    };
  }, []);

  // Fetch dynamic suggestions when form data changes
  useEffect(() => {
    if (!isOpen || !hasFormData) {
      setDynamicSuggestions(undefined);
      return;
    }

    const fetchSuggestions = async () => {
      // Abort previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setSuggestionsLoading(true);
      try {
        const suggestions = await getEmptyChatPromptSuggestions({
          context: formContext,
          files: formFiles,
          importFiles: formImportFiles.map((f) => ({ name: f.name, size: f.size, data: new ArrayBuffer(0) })),
          abortController,
        });
        if (!abortController.signal.aborted) {
          setDynamicSuggestions(suggestions);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('[AIFullScreenChat] Failed to fetch suggestions:', error);
        }
      }
      if (!abortController.signal.aborted) {
        setSuggestionsLoading(false);
      }
    };

    fetchSuggestions();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen, hasFormData, formFiles, formImportFiles, formContext, getEmptyChatPromptSuggestions]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setFormFiles([]);
      setFormImportFiles([]);
      setFormContext({});
      setDynamicSuggestions(undefined);
      setSuggestionsLoading(false);
      abortControllerRef.current?.abort();
    }
  }, [isOpen]);

  // Focus textarea when overlay opens and set data attribute for z-index override
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-fullscreen-chat', 'true');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      document.body.removeAttribute('data-fullscreen-chat');
    }
    return () => {
      document.body.removeAttribute('data-fullscreen-chat');
    };
  }, [isOpen]);

  // Close overlay immediately when user sends a message (loading starts)
  useEffect(() => {
    if (isOpen && loading) {
      // Ensure the AI panel stays open when we close the full-screen chat
      setShowAIAnalyst(true);
      setIsOpen(false);
    }
  }, [isOpen, loading, setIsOpen, setShowAIAnalyst]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleExampleClick = useCallback((prompt: string) => {
    // Use the events system to set the prompt in the textarea
    events.emit('aiAnalystSetPrompt', prompt);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={cn('fixed inset-0 z-[9999] flex items-center justify-center', 'duration-300 animate-in fade-in')}>
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full bg-muted/50 hover:bg-muted"
        onClick={handleClose}
      >
        <Cross2Icon className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </Button>

      {/* Main content */}
      <div
        className={cn(
          'relative z-10 flex w-full max-w-2xl flex-col items-center gap-8 px-4',
          'duration-500 animate-in slide-in-from-bottom-4'
        )}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
            <AIIcon className="text-white" size="lg" />
          </div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-semibold tracking-tight">
            What would you like to create?
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            Tell me what you're working on and I'll help you build it. You can also attach files or connect to data
            sources.
          </p>
        </div>

        {/* Chat input form */}
        <div className="w-full">
          <AIAnalystUserMessageForm
            ref={textareaRef}
            autoFocusRef={autoFocusRef}
            textareaRef={textareaRef}
            messageIndex={messagesCount}
            initialContext={defaultAIAnalystContext}
            showEmptyChatPromptSuggestions={false}
            uiContext="analyst-new-chat"
            fullScreenMode={true}
          />
          <AIMessageCounterBar />
        </div>

        {/* Example prompts - show dynamic suggestions when user has added data */}
        <div className="flex w-full flex-col gap-3">
          <p className="text-center text-sm text-muted-foreground">
            {hasFormData ? 'Suggested prompts based on your data:' : 'Or try one of these:'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(dynamicSuggestions ?? EXAMPLE_PROMPTS).map(({ label, prompt }, index) => (
              <HoverCard key={`${index}-${label}-card`}>
                <HoverCardTrigger asChild>
                  <Button
                    key={`${index}-${label}`}
                    disabled={suggestionsLoading}
                    variant="outline"
                    size="sm"
                    className="relative h-8 rounded-full border-border/50 bg-muted/30 px-4 text-sm font-normal transition-all hover:border-primary/50 hover:bg-muted/50"
                    onClick={() => handleExampleClick(prompt)}
                  >
                    {suggestionsLoading && <Skeleton className="absolute left-0 top-0 h-full w-full rounded-full" />}
                    <span className={cn(suggestionsLoading && 'opacity-0')}>{label}</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent side="top" align="center" className="max-w-xs">
                  <p className="text-sm">{prompt}</p>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-xs text-muted-foreground/60">
          Press <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-xs">Esc</kbd>{' '}
          to close
        </p>
      </div>
    </div>
  );
});

AIFullScreenChat.displayName = 'AIFullScreenChat';
