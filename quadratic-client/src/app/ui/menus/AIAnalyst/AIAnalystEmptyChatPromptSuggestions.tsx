import type {
  CategorizedEmptyChatPromptSuggestions,
  SuggestionCategory,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import { aiAnalystEmptyChatSuggestionsAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { aiAnalystImportFileTypes, importFilesToSheet, uploadFile } from '@/app/helpers/files';
import { EmptyChatSection, SuggestionButton } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyChatSection';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { PromptIcon } from '@/shared/components/Icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useEffect, useState } from 'react';
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

interface AIAnalystEmptyChatPromptSuggestionsProps {
  submit: (prompt: string) => void;
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
      <Tabs
        value={activeCategory}
        onValueChange={(value) => setActiveCategory(value as SuggestionCategory)}
        className="flex w-full flex-col items-center"
      >
        <EmptyChatSection
          header="Suggestions"
          headerRight={
            <TabsList>
              {SUGGESTION_CATEGORIES.map(({ key, label }) => (
                <TabsTrigger key={key} value={key} className="h-7 px-2 text-xs">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          }
          isLoading={loading}
        >
          {SUGGESTION_CATEGORIES.map(({ key }) => (
            <TabsContent key={key} value={key} className="mt-0 flex flex-col">
              {suggestions[key].map(({ label, prompt }, index) => (
                <SuggestionButton
                  key={`${index}-${prompt}`}
                  icon={<PromptIcon className="flex-shrink-0 text-muted-foreground opacity-50" />}
                  text={label}
                  onClick={() => {
                    trackEvent('[AIAnalyst].submitCategorizedExamplePrompt', { category: key });
                    submit(prompt);
                  }}
                />
              ))}
            </TabsContent>
          ))}
        </EmptyChatSection>
      </Tabs>
    );
  }
);

export const AIAnalystEmptyChatPromptSuggestions = memo(({ submit }: AIAnalystEmptyChatPromptSuggestionsProps) => {
  const [activeCategory, setActiveCategory] = useState<SuggestionCategory>('enrich');
  // Initialize to undefined to avoid flash - only show import section once we know sheet is empty
  const [sheetHasData, setSheetHasData] = useState<boolean | undefined>(undefined);
  const setFilesImportProgressState = useSetRecoilState(filesImportProgressAtom);

  // Get suggestions from centralized state (synced by useEmptyChatSuggestionsSync in QuadraticUI)
  const emptyChatSuggestions = useRecoilValue(aiAnalystEmptyChatSuggestionsAtom);
  const { suggestions: categorizedSuggestions, loading } = emptyChatSuggestions;

  const handleChooseFile = useCallback(async () => {
    trackEvent('[AIAnalyst].chooseFile');
    const selectedFiles = await uploadFile(aiAnalystImportFileTypes);
    if (selectedFiles.length === 0) return;

    const currentSheet = sheets.sheet;

    const aiFiles = await importFilesToSheet({
      files: selectedFiles,
      sheetId: currentSheet.id,
      getBounds: () => currentSheet.bounds,
      getCursorPosition: () => currentSheet.cursor.position.toString(),
      setProgressState: setFilesImportProgressState,
      importFile: quadraticCore.importFile,
    });

    // Send PDFs/images to AI for processing
    if (aiFiles.length > 0) {
      events.emit('aiAnalystDroppedFiles', aiFiles);
    }
  }, [setFilesImportProgressState]);

  // Track whether file has data (for deciding which UI to show)
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

    const checkSheetData = (immediate = false) => {
      clearTimeout(debounceTimeout);
      if (immediate) {
        setSheetHasData(fileHasData());
      } else {
        debounceTimeout = setTimeout(() => {
          const hasData = fileHasData();
          setSheetHasData((prev) => (prev !== hasData ? hasData : prev));
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

  return (
    <div className="absolute -left-1 -right-1 top-[40%] flex -translate-y-1/2 flex-col items-center gap-10 px-4">
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
        <EmptyChatSection header="Suggestions" isLoading={sheetHasData && loading}>
          {defaultPromptSuggestions.map(({ prompt }, index) => (
            <SuggestionButton
              key={`${index}-${prompt}`}
              icon={<PromptIcon className="flex-shrink-0 text-muted-foreground opacity-50" />}
              text={prompt}
              onClick={() => {
                trackEvent('[AIAnalyst].submitExamplePrompt');
                submit(prompt);
              }}
            />
          ))}
        </EmptyChatSection>
      )}
    </div>
  );
});
