import {
  useGetEmptyChatPromptSuggestions,
  type CategorizedEmptyChatPromptSuggestions,
  type SuggestionCategory,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import { aiAnalystActiveSchemaConnectionUuidAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { getExtension, getFileTypeFromName, supportedFileTypesFromGrid, uploadFile } from '@/app/helpers/files';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { EmptyChatSection } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyChatSection';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AddIcon, PromptIcon, SpinnerIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

// Default suggestions shown when the sheet is empty
const defaultPromptSuggestions = [
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
  setContext?: React.Dispatch<React.SetStateAction<Context>>;
}
const SUGGESTION_CATEGORIES: { key: SuggestionCategory; label: string }[] = [
  { key: 'enrich', label: 'Enrich' },
  { key: 'clean', label: 'Clean' },
  { key: 'visualize', label: 'Visualize' },
  { key: 'analyze', label: 'Analyze' },
];

interface CategorizedSuggestionsSectionProps {
  suggestions: CategorizedEmptyChatPromptSuggestions;
  activeCategory: SuggestionCategory;
  setActiveCategory: (category: SuggestionCategory) => void;
  loading: boolean;
  submit: (prompt: string) => void;
}

const CategorizedSuggestionsSection = memo(
  ({ suggestions, activeCategory, setActiveCategory, loading, submit }: CategorizedSuggestionsSectionProps) => {
    return (
      <div className="relative flex w-full max-w-lg flex-col gap-3">
        <h2 className="flex h-6 items-center gap-2 text-xs font-semibold text-muted-foreground">
          Suggestions
          {loading && <SpinnerIcon className="text-primary" />}
        </h2>
        <Tabs
          value={activeCategory}
          onValueChange={(value) => setActiveCategory(value as SuggestionCategory)}
          className="w-full"
        >
          <TabsList className="absolute -top-2 right-0 w-full justify-end">
            {SUGGESTION_CATEGORIES.map(({ key, label }) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SUGGESTION_CATEGORIES.map(({ key }) => (
            <TabsContent key={key} value={key} className="-mx-2 mt-0 flex flex-col">
              {suggestions[key].map(({ label, prompt }, index) => (
                <Button
                  key={`${index}-${prompt}`}
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 whitespace-normal px-2 text-left text-sm font-normal text-foreground hover:text-foreground"
                  onClick={() => {
                    trackEvent('[AIAnalyst].submitCategorizedExamplePrompt', { category: key });
                    submit(prompt);
                  }}
                >
                  <PromptIcon className="flex-shrink-0 text-muted-foreground opacity-50" />
                  <span>{label}</span>
                </Button>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }
);

export const AIAnalystEmptyChatPromptSuggestions = memo(
  ({ submit, setContext }: AIAnalystEmptyChatPromptSuggestionsProps) => {
    const [categorizedSuggestions, setCategorizedSuggestions] = useState<
      CategorizedEmptyChatPromptSuggestions | undefined
    >(undefined);
    const [activeCategory, setActiveCategory] = useState<SuggestionCategory>('enrich');
    const [loading, setLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | undefined>(undefined);
    // Initialize to undefined to avoid flash - only show import section once we know sheet is empty
    const [sheetHasData, setSheetHasData] = useState<boolean | undefined>(undefined);
    const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);
    const { getCategorizedEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();
    // Store in ref to avoid it being a dependency (it changes when connections/loading state changes)
    const getCategorizedEmptyChatPromptSuggestionsRef = useRef(getCategorizedEmptyChatPromptSuggestions);
    getCategorizedEmptyChatPromptSuggestionsRef.current = getCategorizedEmptyChatPromptSuggestions;

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
      // Wait until we know if sheet has data
      if (sheetHasData === undefined) {
        return;
      }

      // If sheet is empty, use default suggestions (no API call needed)
      if (!sheetHasData) {
        setCategorizedSuggestions(undefined);
        setLoading(false);
        return;
      }

      // Sheet has data - fetch categorized suggestions
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const fetchCategorizedSuggestions = async () => {
        setLoading(true);

        try {
          const newCategorizedSuggestions = await getCategorizedEmptyChatPromptSuggestionsRef.current({
            abortController,
          });
          if (!abortController.signal.aborted && newCategorizedSuggestions) {
            setCategorizedSuggestions(newCategorizedSuggestions);
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.warn('[AIAnalystEmptyChatPromptSuggestions] Error fetching categorized suggestions:', error);
          }
        }

        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      };

      fetchCategorizedSuggestions();

      return () => {
        abortController.abort();
      };
    }, [sheetHasData]);

    useEffect(() => {
      if (aiAnalystLoading) {
        abortControllerRef.current?.abort();
      }
    }, [aiAnalystLoading]);

    const connections = useConnectionsFetcher();
    const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);

    const handleClickConnection = useCallback(
      (connectionUuid: string) => {
        trackEvent('[AIAnalyst].selectConnectionFromEmptyChat');
        const connection = connections.connections.find((c) => c.uuid === connectionUuid);
        if (!connection) return;

        setContext?.((prev) => ({
          ...prev,
          connection: { type: connection.type, id: connection.uuid, name: connection.name },
        }));
        setAIAnalystActiveSchemaConnectionUuid(connectionUuid);
      },
      [connections.connections, setContext, setAIAnalystActiveSchemaConnectionUuid]
    );

    return (
      <div className="absolute left-0 right-0 top-[40%] flex -translate-y-1/2 flex-col items-center gap-10 px-4">
        {/* Import Data Section */}
        <div className="flex w-full max-w-lg flex-col items-center gap-3">
          <div className="flex w-full flex-col items-center rounded-lg border-2 border-dashed border-border px-8 py-10">
            <div className="mb-3 flex items-center justify-center gap-1">
              <img src="/images/icon-excel.svg" alt="Excel" className="h-14 w-14" />
              <img src="/images/icon-pdf.svg" alt="PDF" className="h-12 w-12" />
            </div>
            <p className="text-sm">Excel, CSV, PDF, PQT, & images</p>
            <p className="text-xs text-muted-foreground">
              Drag and drop, or{' '}
              <button
                onClick={handleChooseFile}
                className="h-auto p-0 text-xs font-normal text-muted-foreground underline hover:text-foreground"
              >
                choose a file
              </button>
            </p>
          </div>
        </div>

        {/* Suggestions Section */}
        {sheetHasData && categorizedSuggestions ? (
          <CategorizedSuggestionsSection
            suggestions={categorizedSuggestions}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            loading={loading}
            submit={submit}
          />
        ) : (
          <EmptyChatSection
            header="Suggestions"
            isLoading={sheetHasData && loading}
            items={defaultPromptSuggestions.map(({ prompt }, index) => ({
              key: `${index}-${prompt}`,
              icon: <PromptIcon className="flex-shrink-0 text-muted-foreground opacity-50" />,
              text: prompt,
              onClick: () => {
                trackEvent('[AIAnalyst].submitExamplePrompt');
                submit(prompt);
              },
            }))}
          />
        )}

        <EmptyChatSection
          header="Connections"
          items={connections.connections.map((connection) => ({
            key: connection.uuid,
            icon: <LanguageIcon language={connection.type} className="flex-shrink-0" />,
            text: connection.name,
            onClick: () => handleClickConnection(connection.uuid),
          }))}
          emptyState={
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 whitespace-normal px-2 text-left text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              <AddIcon className="flex-shrink-0" />
              <span>Add a connection</span>
            </Button>
          }
        />
      </div>
    );
  }
);
