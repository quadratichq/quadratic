import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
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
      'Show me how to do a GET request using Python. Pull data from https://jsonplaceholder.typicode.com and put it on the sheet. Wrap everything in a single function and have that be the last thing returned to the sheet.',
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

    console.log('TODO (jim):', loading);

    return (
      <div className="absolute bottom-full left-0 mb-1 flex w-full flex-row flex-wrap gap-1">
        {(promptSuggestions ?? defaultPromptSuggestions).map(({ label, prompt }, index) => (
          <button
            key={`${index}-${label}`}
            className="flex items-center gap-3 rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              trackEvent('[AIAnalyst].submitExamplePrompt');
              submit(prompt);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }
);
