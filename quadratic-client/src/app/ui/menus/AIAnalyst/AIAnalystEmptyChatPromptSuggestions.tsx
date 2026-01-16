import {
  useGetEmptyChatPromptSuggestions,
  type EmptyChatPromptSuggestions,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { getExtension, getFileTypeFromName, supportedFileTypesFromGrid, uploadFile } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

// label and prompt are identical here, but the type requires both fields
// for compatibility with AI-generated suggestions which may have different values
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

// All file types supported by the AI Analyst for import
const ALL_IMPORT_FILE_TYPES = ['image/*', '.pdf', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];

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
    const abortControllerRef = useRef<AbortController | undefined>(undefined);
    // Initialize to undefined to avoid flash - only show import section once we know sheet is empty
    const [sheetHasData, setSheetHasData] = useState<boolean | undefined>(undefined);
    const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);
    const { getEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();
    // Store in ref to avoid it being a dependency (it changes when connections/loading state changes)
    const getEmptyChatPromptSuggestionsRef = useRef(getEmptyChatPromptSuggestions);
    getEmptyChatPromptSuggestionsRef.current = getEmptyChatPromptSuggestions;

    // Listen for sheet content changes to update suggestions when data is added/removed
    const handleChooseFile = useCallback(async () => {
      trackEvent('[AIAnalyst].chooseFile');
      const selectedFiles = await uploadFile(ALL_IMPORT_FILE_TYPES);
      if (selectedFiles.length === 0) return;

      // Split files: direct import for spreadsheet files, AI for PDFs/images
      const directImportFiles: File[] = [];
      const aiFiles: File[] = [];

      for (const file of selectedFiles) {
        const extension = `.${getExtension(file.name)}`;
        if (supportedFileTypesFromGrid.includes(extension)) {
          directImportFiles.push(file);
        } else {
          // PDFs and images need AI to extract data
          aiFiles.push(file);
        }
      }

      // Import spreadsheet files directly - each placed to the right of existing content
      if (directImportFiles.length > 0) {
        const currentSheet = sheets.sheet;

        // Sort: push Excel files to the end (they create new sheets, so order matters less)
        directImportFiles.sort((a, b) => {
          const extA = getExtension(a.name);
          const extB = getExtension(b.name);
          if (['xls', 'xlsx'].includes(extA)) return 1;
          if (['xls', 'xlsx'].includes(extB)) return -1;
          return 0;
        });

        // Import files one at a time, calculating position based on current bounds
        for (const file of directImportFiles) {
          const fileType = getFileTypeFromName(file.name);
          if (!fileType || fileType === 'Grid') continue;

          const arrayBuffer = await file.arrayBuffer();

          // Calculate insert position: to the right of existing content
          const sheetBounds = currentSheet.bounds;
          const insertAt = {
            x: sheetBounds.type === 'empty' ? 1 : Number(sheetBounds.max.x) + 2,
            y: 1,
          };

          try {
            await quadraticCore.importFile({
              file: arrayBuffer,
              fileName: file.name,
              fileType,
              sheetId: currentSheet.id,
              location: insertAt,
              cursor: currentSheet.cursor.position.toString(),
              isAi: false,
            });
          } catch (error) {
            console.error('[AIAnalyst] Error importing file:', file.name, error);
          }
        }
      }

      // Send PDFs/images to AI for processing
      if (aiFiles.length > 0) {
        events.emit('aiAnalystDroppedFiles', aiFiles);
      }
    }, []);

    useEffect(() => {
      let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

      const checkSheetData = (immediate = false) => {
        // Debounce to avoid frequent fileHasData() calls on rapid hash changes
        // But allow immediate check for initial load
        clearTimeout(debounceTimeout);
        if (immediate) {
          setSheetHasData(fileHasData());
        } else {
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
        }
      };

      // Initial check - immediate to avoid flash
      checkSheetData(true);

      const onHashContentChanged = () => checkSheetData(false);
      events.on('hashContentChanged', onHashContentChanged);
      return () => {
        events.off('hashContentChanged', onHashContentChanged);
        clearTimeout(debounceTimeout);
      };
    }, []);

    useEffect(() => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const updatePromptSuggestions = async () => {
        setLoading(true);

        try {
          const promptSuggestions = await getEmptyChatPromptSuggestionsRef.current({
            context,
            files,
            importFiles,
            sheetHasData: sheetHasData ?? true, // Treat undefined as having data
            abortController,
          });
          // Only update state if this request wasn't aborted
          if (!abortController.signal.aborted) {
            setPromptSuggestions(promptSuggestions);
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            setPromptSuggestions(undefined);
            console.warn('[AIAnalystEmptyChatPromptSuggestions] getEmptyChatPromptSuggestions: ', error);
          }
        }

        // Only update loading state if this request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      };

      updatePromptSuggestions();

      // Cleanup: abort on unmount or when dependencies change
      return () => {
        abortController.abort();
      };
    }, [context, files, importFiles, sheetHasData]);

    useEffect(() => {
      if (aiAnalystLoading) {
        abortControllerRef.current?.abort();
      }
    }, [aiAnalystLoading]);

    return (
      <div className="absolute left-0 right-0 top-[40%] flex -translate-y-1/2 flex-col items-center gap-10 px-4">
        {/* Import Data Section - always shown, with different text based on sheet content */}
        <div className="flex w-full max-w-lg flex-col items-center gap-3">
          <h2 className="text-xl font-semibold">
            {sheetHasData === false ? 'Start by importing data' : 'Import data'}
          </h2>
          <div className="flex w-full flex-col items-center rounded-lg border-2 border-dashed border-border px-8 py-6">
            <div className="mb-2 flex items-center justify-center gap-2">
              <img src="/images/icon-excel.svg" alt="Excel" className="h-12 w-12" />
              <img src="/images/icon-pdf.svg" alt="PDF" className="h-10 w-10" />
            </div>
            <p className="text-sm font-medium">Excel, CSV, PDF, PQT, or Image</p>
            <p className="text-sm text-muted-foreground">
              Drag and drop, or{' '}
              <Button
                variant="link"
                onClick={handleChooseFile}
                className="h-auto p-0 text-sm text-muted-foreground underline hover:text-foreground"
              >
                choose a file
              </Button>
            </p>
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-xl font-semibold">Suggested prompts</h2>
          <div className="flex max-w-lg flex-col [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-border">
            {(promptSuggestions ?? defaultPromptSuggestions).map(({ prompt }, index) => (
              <div key={`${index}-${prompt}`}>
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
