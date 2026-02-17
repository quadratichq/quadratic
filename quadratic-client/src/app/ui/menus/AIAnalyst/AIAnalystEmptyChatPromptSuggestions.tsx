import type {
  CategorizedEmptyChatPromptSuggestions,
  SuggestionCategory,
} from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import { aiAnalystActiveSchemaConnectionUuidAtom, aiAnalystEmptyChatSuggestionsAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionSyncInfo } from '@/app/atoms/useSyncedConnection';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { aiAnalystImportFileTypes, importFilesToSheet, uploadFile } from '@/app/helpers/files';
import { focusAIAnalyst } from '@/app/helpers/focusGrid';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { EmptyChatSection, SuggestionButton } from '@/app/ui/menus/AIAnalyst/AIAnalystEmptyChatSection';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { AddConnectionMenuItems } from '@/shared/components/connections/ConnectionsMenuContent';
import { ChevronLeftIcon, ChevronRightIcon, PromptIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Connections data
  const { connections } = useConnectionsFetcher();
  const setAIAnalystActiveSchemaConnectionUuid = useSetRecoilState(aiAnalystActiveSchemaConnectionUuidAtom);
  const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  // Get suggestions from centralized state (synced by useEmptyChatSuggestionsSync in QuadraticUI)
  const emptyChatSuggestions = useRecoilValue(aiAnalystEmptyChatSuggestionsAtom);
  const { suggestions: categorizedSuggestions, loading } = emptyChatSuggestions;

  // Pagination for connections (paginate if 5+, otherwise show all)
  const CONNECTIONS_PAGE_SIZE = 3;
  const shouldPaginate = connections.length >= 5;
  const [connectionPage, setConnectionPage] = useState(0);
  const totalPages = Math.ceil(connections.length / CONNECTIONS_PAGE_SIZE);

  // Reset page when connections change
  useEffect(() => {
    setConnectionPage(0);
  }, [connections.length]);

  const visibleConnections = useMemo(() => {
    if (!shouldPaginate) {
      return connections;
    }
    const start = connectionPage * CONNECTIONS_PAGE_SIZE;
    return connections.slice(start, start + CONNECTIONS_PAGE_SIZE);
  }, [connections, connectionPage, shouldPaginate]);

  const paginationLabel = useMemo(() => {
    if (!shouldPaginate) return null;
    const start = connectionPage * CONNECTIONS_PAGE_SIZE + 1;
    const end = Math.min((connectionPage + 1) * CONNECTIONS_PAGE_SIZE, connections.length);
    return `${start}–${end} of ${connections.length}`;
  }, [connectionPage, connections.length, shouldPaginate]);

  const handlePrevPage = useCallback(() => {
    setConnectionPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setConnectionPage((prev) => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  const handleSelectConnection = useCallback(
    (connectionUuid: string, connectionType: ConnectionType, connectionName: string) => {
      trackEvent('[AIAnalyst].selectConnectionFromSuggestions');

      // Open the schema viewer for this connection
      setAIAnalystActiveSchemaConnectionUuid(connectionUuid);

      // Add the connection as context in AI chat (without auto-submitting a prompt)
      events.emit('aiAnalystSelectConnection', connectionUuid, connectionType, connectionName);

      // Focus the AI analyst input
      focusAIAnalyst();
    },
    [setAIAnalystActiveSchemaConnectionUuid]
  );

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

  const hasConnections = connections.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-1">
      <div className="flex w-full flex-col items-center gap-5">
        <div className="flex w-full max-w-lg flex-col items-center gap-2">
          {/* Import Data Section */}
          <div className="flex w-full flex-col items-center gap-3">
            <div className="flex w-full flex-col items-center rounded-lg border-2 border-dashed border-border px-7 py-10">
              <div className="mb-3 flex items-center justify-center gap-1">
                <img src="/images/icon-excel.svg" alt="Excel" className="h-14 w-14" />
                <img src="/images/icon-pdf.svg" alt="PDF" className="h-12 w-12" />
              </div>
              <p className="text-sm">Excel, CSV, PDF, Parquet, & images</p>
              <p className="text-xs text-muted-foreground">
                Drag and drop, or{' '}
                <button
                  onClick={handleChooseFile}
                  className="h-auto p-0 text-xs font-normal text-muted-foreground underline hover:text-foreground"
                >
                  choose a file…
                </button>
              </p>
            </div>
          </div>

          {!hasConnections && <EmptyConnections />}
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

        {hasConnections && (
          <EmptyChatSection
            header="Connections"
            headerRight={
              shouldPaginate ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  {paginationLabel}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-1"
                    onClick={handlePrevPage}
                    disabled={connectionPage === 0}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleNextPage}
                    disabled={connectionPage === totalPages - 1}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              ) : undefined
            }
          >
            {visibleConnections.map((connection) => {
              const { syncState, isReadyForUse } = getConnectionSyncInfo(connection);
              return (
                <SuggestionButton
                  key={connection.uuid}
                  icon={<ConnectionIcon type={connection.type} syncState={syncState} />}
                  text={connection.name}
                  onClick={() => {
                    if (isReadyForUse) {
                      handleSelectConnection(connection.uuid, connection.type, connection.name);
                    } else {
                      setShowConnectionsMenu({
                        initialConnectionUuid: connection.uuid,
                        initialConnectionType: connection.type,
                      });
                    }
                  }}
                />
              );
            })}
          </EmptyChatSection>
        )}
      </div>
    </div>
  );
});

function EmptyConnections() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div
        ref={containerRef}
        className="relative flex w-full cursor-pointer flex-col items-center gap-1 rounded border-2 border-border/40 p-3 text-sm"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setClickPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          setOpen(true);
        }}
      >
        <div className="flex items-center gap-3 pt-3">
          <ConnectionIcon type="POSTGRES" className="h-7 w-7" />
          <ConnectionIcon type="MIXPANEL" className="h-7 w-7" />
          <ConnectionIcon type="SNOWFLAKE" className="h-7 w-7" />
        </div>
        <span className="py-2 text-sm font-normal">Connect your data…</span>

        {/* Invisible anchor positioned at click location */}
        <DropdownMenuTrigger asChild>
          <div className="pointer-events-none absolute h-px w-px" style={{ left: clickPos.x, top: clickPos.y }} />
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent side="right">
        <AddConnectionMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
