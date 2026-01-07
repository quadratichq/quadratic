import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

const defaultPromptSuggestions: EmptyChatPromptSuggestions = [
  {
    label: 'Introduce Quadratic',
    prompt: 'What can you help me with in Quadratic?',
  },
  {
    label: 'Make a chart',
    prompt: 'Help me build a chart in Quadratic. If there is no data on the sheet, add sample data and plot it.',
  },
  {
    label: 'Search for data',
    prompt: 'Search the web for the top 10 tech companies and add them to my sheet.',
  },
];

interface AIAnalystEmptyChatPromptSuggestionsProps {
  submit: (prompt: string) => void;
  context: Context;
  files: FileContent[];
  importFiles: ImportFile[];
}
export const AIAnalystEmptyChatPromptSuggestions = memo(
  ({ submit, context, files, importFiles }: AIAnalystEmptyChatPromptSuggestionsProps) => {
    const [promptSuggestions, setPromptSuggestions] = useState<EmptyChatPromptSuggestions | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const [abortController, setAbortController] = useState<AbortController | undefined>(undefined);
    const [sheetHasData, setSheetHasData] = useState(fileHasData());
    const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);
    const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

    // Listen for sheet content changes to update suggestions when data is added/removed
    useEffect(() => {
      let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

      const checkSheetData = () => {
        // Debounce to avoid frequent fileHasData() calls on rapid hash changes
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          const hasData = fileHasData();
          setSheetHasData((prev) => {
            // Only trigger update if the data presence changed
            if (prev !== hasData) {
              return hasData;
            }
            return prev;
          });
        }, 100);
      };

      events.on('hashContentChanged', checkSheetData);
      return () => {
        events.off('hashContentChanged', checkSheetData);
        clearTimeout(debounceTimeout);
      };
    }, []);

    useEffect(() => {
      const updatePromptSuggestions = async () => {
        // Use ref for synchronous check to prevent concurrent requests
        if (isLoadingRef.current) {
          return;
        }
        isLoadingRef.current = true;
        setLoading(true);

        const abortController = new AbortController();
        try {
          setAbortController((prev) => {
            prev?.abort();
            return abortController;
          });
          const promptSuggestions = await getEmptyChatPromptSuggestions({
            context,
            files,
            importFiles,
            sheetHasData,
            abortController,
          });
          setPromptSuggestions(promptSuggestions);
        } catch (error) {
          setPromptSuggestions(undefined);
          if (!abortController.signal.aborted) {
            abortController.abort();
            console.warn('[AIAnalystEmptyChatPromptSuggestions] getEmptyChatPromptSuggestions: ', error);
          }
        }

        isLoadingRef.current = false;
        setLoading(false);
      };

      updatePromptSuggestions();
    }, [context, files, importFiles, sheetHasData, getEmptyChatPromptSuggestions]);

    useEffect(() => {
      if (aiAnalystLoading) {
        abortController?.abort();
      }
    }, [aiAnalystLoading, abortController]);

    return (
      <div className="absolute left-0 right-0 top-[40%] flex -translate-y-1/2 flex-col items-center gap-4 px-2">
        <h2 className="text-xl font-medium">What would you like to do?</h2>
        <div className="flex flex-row flex-wrap justify-center gap-2">
          {(promptSuggestions ?? defaultPromptSuggestions).map(({ label, prompt }, index) => (
            <HoverCard key={`${index}-${label}-card`}>
              <HoverCardTrigger asChild>
                <Button
                  disabled={loading}
                  variant="secondary"
                  size="sm"
                  className="relative flex h-6 items-center px-2 text-sm font-normal hover:underline"
                  onClick={() => {
                    trackEvent('[AIAnalyst].submitExamplePrompt');
                    submit(prompt);
                  }}
                >
                  {loading && <Skeleton className="absolute left-0 top-0 h-full w-full" />}
                  <span className={cn(loading && 'opacity-0')}>{label}</span>
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="top" align="start">
                <p className="text-sm">{prompt}</p>
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>
      </div>
    );
  }
);
