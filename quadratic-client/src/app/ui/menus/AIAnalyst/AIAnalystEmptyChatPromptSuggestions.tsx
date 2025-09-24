import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useState } from 'react';

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
export function AIAnalystEmptyChatPromptSuggestions({
  submit,
  context,
  files,
  importFiles,
}: AIAnalystEmptyChatPromptSuggestionsProps) {
  const [promptSuggestions, setPromptSuggestions] = useState<EmptyChatPromptSuggestions>(defaultPromptSuggestions);
  const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

  useEffect(() => {
    const updatePromptSuggestions = async () => {
      try {
        const promptSuggestions = await getEmptyChatPromptSuggestions({
          context,
          files,
          importFiles,
        });
        setPromptSuggestions(promptSuggestions ?? defaultPromptSuggestions);
      } catch (error) {
        console.warn('[AIAnalystEmptyChatPromptSuggestions] getEmptyChatPromptSuggestions: ', error);
        setPromptSuggestions(defaultPromptSuggestions);
      }
    };

    updatePromptSuggestions();
  }, [context, files, importFiles, getEmptyChatPromptSuggestions]);

  return (
    <div className="absolute bottom-full left-0 mb-1 flex w-full flex-row flex-wrap gap-1">
      {promptSuggestions.map(({ label, prompt }, index) => (
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
