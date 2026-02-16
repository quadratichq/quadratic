import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import type { TransactionName } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { fileHasMemories, triggerMemoryGeneration } from './aiMemoryService';

const LOAD_CHECK_DELAY_MS = 2500;
const CODE_CELL_DEBOUNCE_MS = 5000;
const IMMEDIATE_DEBOUNCE_MS = 5000;
const DEFERRED_DEBOUNCE_MS = 15000;

// Transactions that represent significant data additions (imports, new tables)
const IMMEDIATE_TRIGGER_TRANSACTIONS: Set<TransactionName> = new Set([
  'Import',
  'DataTableAddDataTable',
  'GridToDataTable',
]);

// Transactions that modify cell data (edits, pastes, moves)
const DEFERRED_TRIGGER_TRANSACTIONS: Set<TransactionName> = new Set([
  'SetCells',
  'PasteClipboard',
  'CutClipboard',
  'Autocomplete',
  'FlattenDataTable',
  'DataTableMutations',
  'MoveCells',
  'SwitchDataTableKind',
  'DataTableFirstRowAsHeader',
]);

/**
 * Listens for code cell execution and data-modifying transactions to trigger
 * AI memory generation. Also triggers when loading a file that has content
 * but no memories yet (e.g. old files, imported CSV/Excel, duplicated files).
 *
 * This hook should be mounted once in the file editor layout.
 */
export function useAiMemoryTrigger(): void {
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileUuidRef = useRef(fileUuid);
  fileUuidRef.current = fileUuid;

  useEffect(() => {
    if (!teamUuid || !fileUuid) return;

    const debounceMemoryGeneration = (delayMs: number) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        triggerMemoryGeneration(teamUuid, fileUuid);
      }, delayMs);
    };

    const handleCodeCellsUpdated = () => {
      debounceMemoryGeneration(CODE_CELL_DEBOUNCE_MS);
    };

    const handleTransactionEnd = (message: { transactionName: TransactionName }) => {
      if (IMMEDIATE_TRIGGER_TRANSACTIONS.has(message.transactionName)) {
        debounceMemoryGeneration(IMMEDIATE_DEBOUNCE_MS);
      } else if (DEFERRED_TRIGGER_TRANSACTIONS.has(message.transactionName)) {
        debounceMemoryGeneration(DEFERRED_DEBOUNCE_MS);
      }
    };

    events.on('updateCodeCells', handleCodeCellsUpdated);
    events.on('transactionEnd', handleTransactionEnd);

    loadCheckTimer.current = setTimeout(async () => {
      try {
        if (fileUuidRef.current !== fileUuid) return;
        const payload = await quadraticCore.getMemoryPayload();
        if (
          !payload ||
          (payload.sheets.length === 0 && payload.codeCells.length === 0 && payload.sheetTables.length === 0)
        )
          return;
        if (fileUuidRef.current !== fileUuid) return;
        const hasMemories = await fileHasMemories(teamUuid, fileUuid);
        if (!hasMemories && fileUuidRef.current === fileUuid) {
          triggerMemoryGeneration(teamUuid, fileUuid);
        }
      } catch {
        // Ignore; grid may not be ready or user may be offline
      }
    }, LOAD_CHECK_DELAY_MS);

    return () => {
      events.off('updateCodeCells', handleCodeCellsUpdated);
      events.off('transactionEnd', handleTransactionEnd);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (loadCheckTimer.current) {
        clearTimeout(loadCheckTimer.current);
      }
    };
  }, [teamUuid, fileUuid]);
}
