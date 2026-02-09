import { aiAnalystCurrentChatMessagesAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FormatPaintIcon, GridActionIcon, TableIcon, TableRowsIcon, UndoIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { isAIPromptMessage, isUserPromptMessage } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

// Tool calls that modify the grid and should be shown as pending changes
const MODIFYING_TOOLS = new Set([
  AITool.SetCellValues,
  AITool.SetCodeCellValue,
  AITool.SetSQLCodeCellValue,
  AITool.SetFormulaCellValue,
  AITool.UpdateCodeCell,
  AITool.DeleteCells,
  AITool.MoveCells,
  AITool.InsertRows,
  AITool.InsertColumns,
  AITool.DeleteRows,
  AITool.DeleteColumns,
  AITool.ResizeRows,
  AITool.ResizeColumns,
  AITool.AddSheet,
  AITool.DeleteSheet,
  AITool.DuplicateSheet,
  AITool.RenameSheet,
  AITool.MoveSheet,
  AITool.ColorSheets,
  AITool.SetBorders,
  AITool.SetTextFormats,
  AITool.AddDataTable,
  AITool.ConvertToTable,
  AITool.TableMeta,
  AITool.TableColumnSettings,
  AITool.AddDateTimeValidation,
  AITool.AddListValidation,
  AITool.AddLogicalValidation,
  AITool.AddNumberValidation,
  AITool.AddTextValidation,
  AITool.RemoveValidations,
]);

interface PendingChange {
  toolCall: AIToolCall;
  label: string;
  name?: string;
  position?: string;
  icon?: React.ReactNode;
}

function getToolCallLabel(toolCall: AIToolCall): PendingChange {
  const toolName = toolCall.name as AITool;
  let label = toolName.replace(/([A-Z])/g, ' $1').trim();
  let name: string | undefined;
  let position: string | undefined;
  let icon: React.ReactNode | undefined;

  try {
    const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};

    switch (toolName) {
      case AITool.SetCodeCellValue:
        label = 'Wrote code';
        name = args.code_cell_name;
        position = args.code_cell_position;
        icon = <LanguageIcon language={args.code_cell_language || ''} />;
        break;
      case AITool.SetSQLCodeCellValue:
        label = 'Wrote SQL';
        name = args.code_cell_name;
        position = args.code_cell_position;
        icon = <LanguageIcon language={args.connection_kind || 'SQL'} />;
        break;
      case AITool.SetFormulaCellValue:
        label = 'Wrote formula';
        position = args.code_cell_position;
        icon = <LanguageIcon language="Formula" />;
        break;
      case AITool.UpdateCodeCell:
        label = 'Updated code';
        icon = <GridActionIcon />;
        break;
      case AITool.SetCellValues:
        label = 'Inserted data';
        position = args.top_left_position;
        icon = <TableRowsIcon className="text-success" />;
        break;
      case AITool.DeleteCells:
        label = 'Deleted cells';
        position = args.selection;
        icon = <GridActionIcon className="text-destructive" />;
        break;
      case AITool.MoveCells:
        label = 'Moved cells';
        // Support both new format (moves array) and old format
        position = args.moves?.[0]?.target_top_left_position ?? args.target_top_left_position;
        icon = <GridActionIcon />;
        break;
      case AITool.InsertRows:
        label = 'Inserted rows';
        icon = <GridActionIcon className="text-success" />;
        break;
      case AITool.InsertColumns:
        label = 'Inserted columns';
        icon = <GridActionIcon className="text-success" />;
        break;
      case AITool.DeleteRows:
        label = 'Deleted rows';
        icon = <GridActionIcon className="text-destructive" />;
        break;
      case AITool.DeleteColumns:
        label = 'Deleted columns';
        icon = <GridActionIcon className="text-destructive" />;
        break;
      case AITool.ResizeRows:
        label = 'Resized rows';
        position = args.selection;
        icon = <GridActionIcon />;
        break;
      case AITool.ResizeColumns:
        label = 'Resized columns';
        position = args.selection;
        icon = <GridActionIcon />;
        break;
      case AITool.AddSheet:
        label = 'Created sheet';
        name = args.sheet_name;
        icon = <GridActionIcon className="text-success" />;
        break;
      case AITool.DeleteSheet:
        label = 'Deleted sheet';
        name = args.sheet_name;
        icon = <GridActionIcon className="text-destructive" />;
        break;
      case AITool.RenameSheet:
        label = 'Renamed sheet';
        name = args.new_sheet_name;
        icon = <GridActionIcon />;
        break;
      case AITool.SetBorders:
        label = 'Formatted borders';
        position = args.selection;
        icon = <FormatPaintIcon />;
        break;
      case AITool.SetTextFormats:
        label = 'Formatted';
        position = args.selection;
        icon = <FormatPaintIcon />;
        break;
      case AITool.AddDataTable:
        label = 'Inserted table';
        name = args.table_name;
        position = args.top_left_position;
        icon = <TableIcon className="text-success" />;
        break;
      case AITool.TableMeta:
        label = 'Table changes';
        position = args.table_location;
        icon = <GridActionIcon />;
        break;
      case AITool.TableColumnSettings:
        label = 'Table column settings';
        position = args.table_location;
        icon = <GridActionIcon />;
        break;
      case AITool.ConvertToTable:
        label = 'Converted to table';
        name = args.table_name;
        position = args.selection;
        icon = <TableIcon />;
        break;
      default:
        // Convert camelCase to readable text
        label = toolName
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .toLowerCase();
        label = label.charAt(0).toUpperCase() + label.slice(1);
    }
  } catch {
    // Keep default label if parsing fails
  }

  return { toolCall, label, name, position, icon };
}

export const AIPendingChanges = memo(() => {
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [isExpanded, setIsExpanded] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [userMadeChanges, setUserMadeChanges] = useState(false);
  const lastToolCallCountRef = useRef(0);

  // Deduplicate by position - if the same cell is changed multiple times, only show the latest
  // Also track total tool call count for accurate undo operations
  const { pendingChanges, totalToolCallCount } = useMemo(() => {
    if (loading) return { pendingChanges: [], totalToolCallCount: 0 };

    // Find the last user prompt message index
    let lastUserPromptIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (isUserPromptMessage(message)) {
        lastUserPromptIndex = i;
        break;
      }
    }

    // Use a Map to deduplicate by position - later changes overwrite earlier ones
    // Key format: "toolName:position" for position-based changes, or unique ID for others
    const changesMap = new Map<string, PendingChange>();
    let nonPositionCounter = 0;
    let toolCallCount = 0;

    // Collect all modifying tool calls from AI messages after the last user prompt
    for (let i = lastUserPromptIndex + 1; i < messages.length; i++) {
      const message = messages[i];
      if (isAIPromptMessage(message)) {
        for (const toolCall of message.toolCalls) {
          if (MODIFYING_TOOLS.has(toolCall.name as AITool) && !toolCall.loading) {
            toolCallCount++;
            const change = getToolCallLabel(toolCall);

            // Create a unique key based on position if available
            let key: string;
            if (change.position) {
              // For position-based changes, deduplicate by tool type + position
              key = `${toolCall.name}:${change.position}`;
            } else {
              // For non-position changes, use a unique counter to preserve all
              key = `${toolCall.name}:${nonPositionCounter++}`;
            }

            changesMap.set(key, change);
          }
        }
      }
    }

    return { pendingChanges: Array.from(changesMap.values()), totalToolCallCount: toolCallCount };
  }, [messages, loading]);

  // Reset state when a new AI request starts (loading becomes true)
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (loading && !wasLoadingRef.current) {
      // New AI request starting - reset user changes flag
      setUserMadeChanges(false);
      lastToolCallCountRef.current = 0;
      setIsExpanded(false);
    }
    wasLoadingRef.current = loading;
  }, [loading]);

  // Update undo count when changes come in
  // Use totalToolCallCount (not deduplicated) for accurate undo operations
  useEffect(() => {
    if (totalToolCallCount > 0 && !loading) {
      setUndoCount(totalToolCallCount);
      // Reset user changes flag when new AI changes come in
      if (totalToolCallCount !== lastToolCallCountRef.current) {
        setUserMadeChanges(false);
        lastToolCallCountRef.current = totalToolCallCount;
      }
    }
  }, [totalToolCallCount, loading]);

  // Listen for transaction events to detect when user makes changes
  // after AI has made changes
  const ignoreTransactionsRef = useRef(true);

  // When pending changes update, ignore transactions briefly to let AI's own transactions complete
  useEffect(() => {
    if (pendingChanges.length === 0 || loading) {
      ignoreTransactionsRef.current = true;
      return;
    }

    // Ignore transactions for a short time after AI changes arrive
    // This prevents AI's own transactions from triggering userMadeChanges
    ignoreTransactionsRef.current = true;
    const timeout = setTimeout(() => {
      ignoreTransactionsRef.current = false;
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, [pendingChanges.length, loading]);

  useEffect(() => {
    if (pendingChanges.length === 0 || loading) return;

    const handleTransactionEnd = () => {
      // Only mark as user changes if we're past the initial ignore window
      if (!ignoreTransactionsRef.current) {
        setUserMadeChanges(true);
      }
    };

    events.on('transactionEnd', handleTransactionEnd);

    return () => {
      events.off('transactionEnd', handleTransactionEnd);
    };
  }, [pendingChanges.length, loading]);

  const handleUndo = useCallback(async () => {
    if (undoCount > 0 && !userMadeChanges) {
      try {
        await quadraticCore.undo(undoCount, false);
      } catch (e) {
        console.error('Failed to undo AI changes:', e);
        pixiAppSettings.addGlobalSnackbar?.('Failed to undo AI changes', { severity: 'error' });
      }
    }
  }, [undoCount, userMadeChanges]);

  const handleNavigateToChange = useCallback((change: PendingChange) => {
    if (!change.position) return;

    try {
      const args = change.toolCall.arguments ? JSON.parse(change.toolCall.arguments) : {};
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const toolName = change.toolCall.name as AITool;

      // For SetCellValues and AddDataTable, calculate the full range based on data dimensions
      if (toolName === AITool.SetCellValues && args.cell_values && Array.isArray(args.cell_values)) {
        const rows = args.cell_values.length;
        const cols = args.cell_values.reduce((max: number, row: unknown[]) => Math.max(max, row.length), 0);
        const startSelection = sheets.stringToSelection(change.position, sheetId);
        const { x, y } = startSelection.getCursor();
        startSelection.free();
        const endX = x + cols - 1;
        const endY = y + rows - 1;
        const rangeString = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
        const selection = sheets.stringToSelection(rangeString, sheetId);
        sheets.changeSelection(selection);
        return;
      }

      if (toolName === AITool.AddDataTable && args.table_data && Array.isArray(args.table_data)) {
        const rows = args.table_data.length;
        const cols = args.table_data.reduce((max: number, row: unknown[]) => Math.max(max, row.length), 0);
        const startSelection = sheets.stringToSelection(change.position, sheetId);
        const { x, y } = startSelection.getCursor();
        startSelection.free();
        const endX = x + cols - 1;
        const endY = y + rows - 1;
        const rangeString = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
        const selection = sheets.stringToSelection(rangeString, sheetId);
        sheets.changeSelection(selection);
        return;
      }

      // Default: just select the position
      const selection = sheets.stringToSelection(change.position, sheetId);
      sheets.changeSelection(selection);
    } catch (e) {
      console.warn('Failed to navigate to change:', e);
    }
  }, []);

  // Don't show if loading or no changes
  if (loading || pendingChanges.length === 0) {
    return null;
  }

  return (
    <div className="rounded-border-tr mx-4 overflow-hidden rounded-tl rounded-tr border border-b-0 border-border bg-background">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-1 py-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {isExpanded ? <ChevronDownIcon className="ml-1 mr-0.5" /> : <ChevronRightIcon className="ml-1 mr-0.5" />}
          {pendingChanges.length} change{pendingChanges.length === 1 ? '' : 's'}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 shrink-0 gap-1 border-border bg-background px-2 text-xs text-muted-foreground ${userMadeChanges ? 'invisible' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleUndo();
            }}
            title={`Undo ${undoCount} AI change${undoCount === 1 ? '' : 's'}`}
          >
            <UndoIcon className="inline-block h-3 w-3" />
            Undo
          </Button>
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="mb-1 max-h-44 overflow-y-auto">
          {pendingChanges.map((change, index) => (
            <div
              key={`${change.toolCall.id}-${index}`}
              className={`flex items-center gap-2 px-2 py-1.5 text-[13px] ${change.position ? 'cursor-pointer hover:bg-accent/50' : ''}`}
              onClick={() => change.position && handleNavigateToChange(change)}
            >
              {change.icon && <div className="flex h-4 w-4 shrink-0 items-center justify-center">{change.icon}</div>}
              <span className="truncate">
                {change.label}
                {change.name && <span className="ml-1 text-foreground">· {change.name}</span>}
                {change.position && <span className="ml-1 opacity-70">· {change.position}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
