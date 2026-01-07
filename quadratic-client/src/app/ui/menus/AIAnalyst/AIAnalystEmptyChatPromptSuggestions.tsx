import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { uploadFile } from '@/app/helpers/files';
import { AIUserMessageFormConnectionsButton } from '@/app/ui/components/AIUserMessageFormConnectionsButton';
import { FileIcon, PDFIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const defaultPromptSuggestions: EmptyChatPromptSuggestions = [
  {
    label: 'What can you help me with in Quadratic?',
    prompt: 'What can you help me with in Quadratic?',
  },
  {
    label: 'Help me build a chart in Quadratic. If there is no data, add some sample data and then plot it.',
    prompt: 'Help me build a chart in Quadratic. If there is no data, add some sample data and then plot it.',
  },
  {
    label: 'Search the web for the top 10 tech companies by market cap and add them to my sheet.',
    prompt: 'Search the web for the top 10 tech companies by market cap and add them to my sheet.',
  },
];

const EXCEL_FILE_TYPES = ['.xlsx', '.xls'];
const CSV_FILE_TYPES = ['.csv', '.parquet', '.parq', '.pqt'];
const PDF_FILE_TYPES = ['.pdf'];

interface ImportButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const ImportButton = ({ icon, label, onClick }: ImportButtonProps) => (
  <button
    onClick={onClick}
    className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 transition-all hover:bg-accent"
  >
    <span className="flex h-5 w-5 shrink-0 items-center justify-center leading-none">{icon}</span>
    <span className="text-sm">{label}</span>
  </button>
);

interface AIAnalystEmptyChatPromptSuggestionsProps {
  submit: (prompt: string) => void;
  context: Context;
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
  files: FileContent[];
  importFiles: ImportFile[];
}
export const AIAnalystEmptyChatPromptSuggestions = memo(
  ({ submit, context, setContext, files, importFiles }: AIAnalystEmptyChatPromptSuggestionsProps) => {
    const [promptSuggestions, setPromptSuggestions] = useState<EmptyChatPromptSuggestions | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | undefined>(undefined);
    const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);
    const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

    const handleImportFile = useCallback(async (fileTypes: string[], eventName: string) => {
      trackEvent(eventName);
      const selectedFiles = await uploadFile(fileTypes);
      if (selectedFiles.length > 0) {
        events.emit('aiAnalystDroppedFiles', selectedFiles);
      }
    }, []);

    const handleImportExcel = useCallback(() => {
      handleImportFile(EXCEL_FILE_TYPES, '[AIAnalyst].importExcel');
    }, [handleImportFile]);

    const handleImportCsv = useCallback(() => {
      handleImportFile(CSV_FILE_TYPES, '[AIAnalyst].importCsv');
    }, [handleImportFile]);

    const handleImportPdf = useCallback(() => {
      handleImportFile(PDF_FILE_TYPES, '[AIAnalyst].importPdf');
    }, [handleImportFile]);

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
      <div className="absolute left-0 right-0 top-[40%] flex -translate-y-1/2 flex-col items-center gap-6 px-4">
        {/* Import Data Section */}
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-lg font-medium">Start by importing your data</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <ImportButton
              icon={<img src="/images/icon-excel.svg" alt="Excel" className="h-5 w-5" />}
              label="Excel"
              onClick={handleImportExcel}
            />
            <ImportButton icon={<PDFIcon className="!text-red-500" />} label="PDF" onClick={handleImportPdf} />
            <ImportButton
              icon={<FileIcon className="!text-muted-foreground" />}
              label="CSV, PQT, other files"
              onClick={handleImportCsv}
            />
            <AIUserMessageFormConnectionsButton context={context} setContext={setContext} variant="empty-state" />
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-lg font-medium">Or start with a suggested prompt</h2>
          <div className="flex max-w-lg flex-col [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-border">
            {(promptSuggestions ?? defaultPromptSuggestions).map(({ prompt }) => (
              <div key={prompt}>
                <Button
                  disabled={loading}
                  variant="ghost"
                  className="relative h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-sm font-normal text-foreground hover:text-foreground"
                  onClick={() => {
                    trackEvent('[AIAnalyst].submitExamplePrompt');
                    submit(prompt);
                  }}
                >
                  {loading && <Skeleton className="absolute left-0 top-0 h-full w-full" />}
                  <span className={cn(loading && 'opacity-0')}>{prompt}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
