import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/shadcn/ui/hover-card';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const defaultPromptSuggestions: EmptyChatPromptSuggestions = [
  {
    label: 'Build a chart',
    prompt: 'Help me build a chart in Quadratic. If there is no data on the sheet add sample data and plot it.',
  },
  {
    label: 'Search the web',
    prompt: 'Search the web for the top 10 companies in the US by revenue.',
  },
  {
    label: 'Connect an API',
    prompt:
      'Show me how to do a GET request using Python. Pull data from jsonplaceholder.typicode.com and put it on the sheet. Wrap everything in a single function and have that be the last thing returned to the sheet.',
  },
];

interface AIAnalystEmptyChatPromptSuggestionsProps {
  submit: (prompt: string) => void;
  context: Context;
  files: FileContent[];
  importFiles: ImportFile[];
  showWaypoints?: boolean;
}
export const AIAnalystEmptyChatPromptSuggestions = memo(
  ({ submit, context, files, importFiles, showWaypoints }: AIAnalystEmptyChatPromptSuggestionsProps) => {
    const [promptSuggestions, setPromptSuggestions] = useState<EmptyChatPromptSuggestions | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | undefined>(undefined);
    const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);
    const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

    useEffect(() => {
      const updatePromptSuggestions = async () => {
        let prevLoading;
        setLoading((prev) => {
          prevLoading = prev;
          return true;
        });
        if (prevLoading) {
          return;
        }

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

        setLoading(false);
      };

      updatePromptSuggestions();
    }, [context, files, importFiles, getEmptyChatPromptSuggestions]);

    useEffect(() => {
      if (aiAnalystLoading) {
        abortController?.abort();
      }
    }, [aiAnalystLoading, abortController]);

    return (
      <div className="absolute bottom-full left-0 mb-2 flex w-full flex-row flex-wrap gap-2">
        {showWaypoints && (
          <div className="absolute bottom-full left-6 mb-2 flex flex-col text-muted-foreground">
            <h3 className="text-sm">Try a suggestion</h3>
            <p className="hidden text-xs">See what’s possible based on your sheet.</p>
            <svg
              width="16"
              height="60"
              viewBox="0 0 16 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mt-2 rotate-180 text-border"
            >
              <path
                d="M8.70715 0.292894C8.31662 -0.0976309 7.68346 -0.0976312 7.29293 0.292893L0.92897 6.65685C0.538446 7.04738 0.538445 7.68054 0.928969 8.07106C1.31949 8.46159 1.95266 8.46159 2.34318 8.07107L8.00004 2.41421L13.6569 8.07107C14.0474 8.46159 14.6806 8.4616 15.0711 8.07107C15.4616 7.68055 15.4616 7.04738 15.0711 6.65686L8.70715 0.292894ZM8 100L9 100L9.00004 1L8.00004 1L7.00004 1L7 100L8 100Z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
        {(promptSuggestions ?? defaultPromptSuggestions).map(({ label, prompt }, index) => (
          <HoverCard key={`${index}-${label}-card`}>
            <HoverCardTrigger asChild>
              <Button
                key={`${index}-${label}`}
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
            <HoverCardContent>
              <p className="text-sm">{prompt}</p>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    );
  }
);
