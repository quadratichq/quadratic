import { aiAnalystCurrentChatMessagesAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { UndoIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { isAIPromptMessage, isUserPromptMessage } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

// Tool calls that modify the grid and should be shown as pending changes
const MODIFYING_TOOLS = new Set([
  AITool.SetCellValues,
  AITool.SetCodeCellValue,
  AITool.SetSQLCodeCellValue,
  AITool.SetFormulaCellValue,
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
  description?: string;
  position?: string;
  icon?: React.ReactNode;
}

function getToolCallLabel(toolCall: AIToolCall): PendingChange {
  const toolName = toolCall.name as AITool;
  let label = toolName.replace(/([A-Z])/g, ' $1').trim();
  let description: string | undefined;
  let position: string | undefined;
  let icon: React.ReactNode | undefined;

  try {
    const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};

    switch (toolName) {
      case AITool.SetCodeCellValue:
        label = 'Wrote code';
        position = args.code_cell_position;
        icon = <LanguageIcon language={args.code_cell_language || ''} />;
        break;
      case AITool.SetSQLCodeCellValue:
        label = 'Wrote SQL';
        position = args.code_cell_position;
        icon = <LanguageIcon language={args.connection_kind || 'SQL'} />;
        break;
      case AITool.SetFormulaCellValue:
        label = 'Wrote formula';
        position = args.code_cell_position;
        icon = <LanguageIcon language="Formula" />;
        break;
      case AITool.SetCellValues:
        label = 'Set cell values';
        position = args.selection;
        break;
      case AITool.DeleteCells:
        label = 'Deleted cells';
        position = args.selection;
        break;
      case AITool.MoveCells:
        label = 'Moved cells';
        description = `from ${args.source_selection} to ${args.target_top_left_position}`;
        break;
      case AITool.InsertRows:
        label = `Inserted ${args.row_count || 1} row(s)`;
        break;
      case AITool.InsertColumns:
        label = `Inserted ${args.column_count || 1} column(s)`;
        break;
      case AITool.DeleteRows:
        label = 'Deleted rows';
        break;
      case AITool.DeleteColumns:
        label = 'Deleted columns';
        break;
      case AITool.AddSheet:
        label = `Created sheet "${args.sheet_name || 'New Sheet'}"`;
        break;
      case AITool.DeleteSheet:
        label = `Deleted sheet "${args.sheet_name}"`;
        break;
      case AITool.RenameSheet:
        label = `Renamed sheet to "${args.new_sheet_name}"`;
        break;
      case AITool.SetBorders:
        label = 'Set borders';
        position = args.selection;
        break;
      case AITool.SetTextFormats:
        label = 'Formatted cells';
        position = args.selection;
        break;
      case AITool.AddDataTable:
        label = 'Added data table';
        position = args.top_left_position;
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

  return { toolCall, label, description, position, icon };
}

export const AIPendingChanges = memo(() => {
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [isExpanded, setIsExpanded] = useState(false);
  const [undoCount, setUndoCount] = useState(0);

  // Get the pending changes from the latest AI response chain
  // (all AI messages after the last user message)
  // Deduplicate by position - if the same cell is changed multiple times, only show the latest
  const pendingChanges = useMemo(() => {
    if (loading) return [];

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

    // Collect all modifying tool calls from AI messages after the last user prompt
    for (let i = lastUserPromptIndex + 1; i < messages.length; i++) {
      const message = messages[i];
      if (isAIPromptMessage(message)) {
        for (const toolCall of message.toolCalls) {
          if (MODIFYING_TOOLS.has(toolCall.name as AITool) && !toolCall.loading) {
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

    return Array.from(changesMap.values());
  }, [messages, loading]);

  // Update undo count when changes come in
  useEffect(() => {
    if (pendingChanges.length > 0 && !loading) {
      setUndoCount(pendingChanges.length);
    }
  }, [pendingChanges.length, loading]);

  const handleUndo = useCallback(async () => {
    if (undoCount > 0) {
      await quadraticCore.undo(undoCount, false);
    }
  }, [undoCount]);

  const handleNavigateToChange = useCallback((change: PendingChange) => {
    if (!change.position) return;

    try {
      const args = change.toolCall.arguments ? JSON.parse(change.toolCall.arguments) : {};
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
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
    <div className="mx-2 mb-2 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 hover:bg-accent/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            Latest changes
            <span className="ml-1.5 text-muted-foreground">({pendingChanges.length})</span>
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleUndo();
          }}
        >
          <UndoIcon className="h-3.5 w-3.5" />
          Undo
        </Button>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="max-h-48 overflow-y-auto">
            {pendingChanges.map((change, index) => (
              <div
                key={`${change.toolCall.id}-${index}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm',
                  change.position && 'cursor-pointer hover:bg-accent/50'
                )}
                onClick={() => handleNavigateToChange(change)}
              >
                {change.icon && <div className="flex h-4 w-4 shrink-0 items-center justify-center">{change.icon}</div>}
                <span className="truncate text-muted-foreground">
                  {change.label}
                  {change.position && <span className="ml-1 text-xs opacity-70">at {change.position}</span>}
                  {change.description && <span className="ml-1 text-xs opacity-70">{change.description}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
