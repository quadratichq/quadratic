import { emptyChatSuggestionsAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { MAX_ROWS } from '@/app/ai/constants/context';
import { useGetEmptyChatPromptSuggestions } from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

const DEBOUNCE_MS = 500;

// Minimum number of cells with data to be considered "meaningful" for flat data
const MIN_FLAT_DATA_CELLS = 10;

/**
 * Simple string hashing function.
 */
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
};

interface DataAnalysis {
  hasMeaningfulData: boolean;
  structuralFingerprint: string;
}

/**
 * Analyzes the file data to determine:
 * 1. If it has "meaningful data" worth generating suggestions for
 * 2. A structural fingerprint for detecting significant changes
 *
 * Meaningful data is defined as:
 * - At least one data table, code table, chart, or connection, OR
 * - At least MIN_FLAT_DATA_CELLS cells of flat data
 *
 * The structural fingerprint captures table structure (names, bounds, headers)
 * but NOT cell values, so changing a value won't trigger regeneration.
 */
const analyzeFileData = async (): Promise<DataAnalysis> => {
  if (!fileHasData()) {
    return { hasMeaningfulData: false, structuralFingerprint: '' };
  }

  const selections = sheets.sheets.map((sheet) => sheets.stringToSelection('*', sheet.id).save());
  const sheetsContext = await quadraticCore.getAISelectionContexts({
    selections,
    maxRows: MAX_ROWS,
  });

  if (!sheetsContext) {
    return { hasMeaningfulData: false, structuralFingerprint: '' };
  }

  let totalFlatDataCells = 0;
  let hasStructuredData = false;

  // Build structural fingerprint - captures structure, not values
  const fingerprintParts: string[] = [];
  fingerprintParts.push(`sheets:${sheets.sheets.length}`);

  for (const sheetContext of sheetsContext) {
    // Data tables
    if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
      hasStructuredData = true;
      for (const table of sheetContext.data_tables) {
        // Include table name, bounds, and column headers in fingerprint
        // Use all_columns which contains the actual column names
        const headers = table.all_columns?.join(',') ?? '';
        fingerprintParts.push(`dt:${table.data_table_name}:${table.bounds}:${headers}`);
      }
    }

    // Code tables
    if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
      hasStructuredData = true;
      for (const table of sheetContext.code_tables) {
        const headers = table.all_columns?.join(',') ?? '';
        fingerprintParts.push(`ct:${table.code_table_name}:${table.bounds}:${headers}`);
      }
    }

    // Charts
    if (sheetContext.charts && sheetContext.charts.length > 0) {
      hasStructuredData = true;
      for (const chart of sheetContext.charts) {
        fingerprintParts.push(`ch:${chart.chart_name}:${chart.bounds}`);
      }
    }

    // Connections
    if (sheetContext.connections && sheetContext.connections.length > 0) {
      hasStructuredData = true;
      for (const conn of sheetContext.connections) {
        const headers = conn.all_columns?.join(',') ?? '';
        fingerprintParts.push(`conn:${conn.code_table_name}:${conn.bounds}:${headers}`);
      }
    }

    // Flat data - only count cells for threshold, don't include in fingerprint
    // Flat data bounds are too volatile (change on any cell edit) so we only
    // use them to determine if there's "enough" data, not for change detection
    if (sheetContext.data_rects) {
      for (const dataRect of sheetContext.data_rects) {
        if (dataRect.start_values) {
          totalFlatDataCells += dataRect.start_values.length;
        }
      }
    }
  }

  const hasMeaningfulData = hasStructuredData || totalFlatDataCells >= MIN_FLAT_DATA_CELLS;
  const structuralFingerprint = hashString(fingerprintParts.join('|'));

  return { hasMeaningfulData, structuralFingerprint };
};

/**
 * Hook that syncs empty chat suggestions with sheet data changes.
 *
 * Listens to `hashContentChanged` events (debounced), generates a structural
 * fingerprint of the data, and fetches new suggestions only when the structure
 * changes significantly (e.g., tables added/removed, columns changed).
 *
 * Changing cell values does NOT trigger regeneration - only structural changes do.
 *
 * This should be mounted once at a high level in the component tree.
 */
export function useEmptyChatSuggestionsSync() {
  const [emptyChatSuggestions, setEmptyChatSuggestions] = useAtom(emptyChatSuggestionsAtom);
  const { getCategorizedEmptyChatPromptSuggestions } = useGetEmptyChatPromptSuggestions();

  // Store refs to avoid stale closures in the debounced handler
  const emptyChatSuggestionsRef = useRef(emptyChatSuggestions);
  emptyChatSuggestionsRef.current = emptyChatSuggestions;

  const getCategorizedEmptyChatPromptSuggestionsRef = useRef(getCategorizedEmptyChatPromptSuggestions);
  getCategorizedEmptyChatPromptSuggestionsRef.current = getCategorizedEmptyChatPromptSuggestions;

  const checkAndUpdateSuggestions = useCallback(async () => {
    // Analyze file data for meaningful content and structural fingerprint
    const { hasMeaningfulData, structuralFingerprint } = await analyzeFileData();

    if (!hasMeaningfulData) {
      // Clear suggestions if data is empty or trivial
      if (emptyChatSuggestionsRef.current.suggestions || emptyChatSuggestionsRef.current.contextHash) {
        setEmptyChatSuggestions({
          suggestions: undefined,
          contextHash: undefined,
          loading: false,
          abortController: undefined,
        });
      }
      return;
    }

    // If structural fingerprint matches, data structure hasn't changed - do nothing
    // This means changing cell values won't trigger regeneration, only structural changes will
    if (structuralFingerprint === emptyChatSuggestionsRef.current.contextHash) {
      return;
    }

    // Structure changed - fetch new suggestions
    const abortController = new AbortController();

    setEmptyChatSuggestions((prev) => ({
      ...prev,
      loading: true,
      abortController,
    }));

    try {
      const newSuggestions = await getCategorizedEmptyChatPromptSuggestionsRef.current({
        abortController,
      });

      if (!abortController.signal.aborted) {
        setEmptyChatSuggestions({
          suggestions: newSuggestions,
          contextHash: structuralFingerprint,
          loading: false,
          abortController: undefined,
        });
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.warn('[useEmptyChatSuggestionsSync] Error fetching suggestions:', error);
        setEmptyChatSuggestions((prev) => ({
          ...prev,
          loading: false,
          abortController: undefined,
        }));
      }
    }
  }, [setEmptyChatSuggestions]);

  // Listen to hashContentChanged events and debounce updates
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleHashContentChanged = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        checkAndUpdateSuggestions();
      }, DEBOUNCE_MS);
    };

    events.on('hashContentChanged', handleHashContentChanged);

    return () => {
      events.off('hashContentChanged', handleHashContentChanged);
      clearTimeout(debounceTimeout);
      // Abort any in-flight request on unmount
      emptyChatSuggestionsRef.current.abortController?.abort();
    };
  }, [checkAndUpdateSuggestions]);

  // Initial fetch on mount (if file has data but no suggestions yet)
  useEffect(() => {
    const { suggestions, loading } = emptyChatSuggestionsRef.current;
    if (!suggestions && !loading) {
      checkAndUpdateSuggestions();
    }
  }, [checkAndUpdateSuggestions]);
}
