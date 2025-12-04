import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo, useState } from 'react';

// Tool names that should be grouped together as "code" tools
const CODE_TOOL_NAMES = new Set([AITool.SetCodeCellValue, AITool.UpdateCodeCell, AITool.SetFormulaCellValue]);

export function isCodeTool(toolName: string): boolean {
  return CODE_TOOL_NAMES.has(toolName as AITool);
}

interface GroupedCodeToolCardsProps {
  toolCalls: AIToolCall[];
  className?: string;
}

export const GroupedCodeToolCards = memo(({ toolCalls, className }: GroupedCodeToolCardsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const isLoading = toolCalls.some((tc) => tc.loading);

  // Try to extract sheet name from the first tool call
  const sheetInfo = useMemo(() => {
    for (const toolCall of toolCalls) {
      if (toolCall.arguments) {
        try {
          const args = JSON.parse(toolCall.arguments);
          if (args.sheet_name) {
            return args.sheet_name;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return null;
  }, [toolCalls]);

  // Determine which tool calls are "updates" (same position written more than once)
  const { newCount, updateCount, updateIndices } = useMemo(() => {
    const seenPositions = new Set<string>();
    const updateIndices = new Set<number>();
    let newCount = 0;
    let updateCount = 0;

    toolCalls.forEach((toolCall, index) => {
      if (!toolCall.arguments) {
        newCount++;
        return;
      }
      try {
        const args = JSON.parse(toolCall.arguments);
        // Get position key: "sheetName!position" or just "position"
        const position = args.code_cell_position || args.cell_position;
        if (!position) {
          newCount++;
          return;
        }

        const positionKey = `${args.sheet_name || ''}!${position}`;

        if (seenPositions.has(positionKey)) {
          updateCount++;
          updateIndices.add(index);
        } else {
          seenPositions.add(positionKey);
          newCount++;
        }
      } catch {
        // If we can't parse, count as new
        newCount++;
      }
    });

    return { newCount, updateCount, updateIndices };
  }, [toolCalls]);

  const label = useMemo(() => {
    const sheetText = sheetInfo ? ` in ${sheetInfo}` : '';

    if (isLoading) {
      const total = toolCalls.length;
      const cellText = total === 1 ? 'cell' : 'cells';
      return `Writing ${total} code ${cellText}${sheetText}`;
    }

    // Build a descriptive label
    const total = toolCalls.length;
    const cellText = total === 1 ? 'cell' : 'cells';

    if (newCount > 0 && updateCount > 0) {
      return `Wrote ${newCount} new, updated ${updateCount} code ${cellText}${sheetText}`;
    } else if (updateCount > 0) {
      return `Updated ${updateCount} code ${cellText}${sheetText}`;
    } else {
      return `Wrote ${newCount} new code ${cellText}${sheetText}`;
    }
  }, [isLoading, toolCalls.length, sheetInfo, newCount, updateCount]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <LanguageIcon language="Python" />
        <span>{label}</span>
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="ml-[7px] mt-1 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
          {toolCalls.map((toolCall, index) => (
            <AIToolCard
              key={`${index}-${toolCall.id}-${toolCall.name}`}
              toolCall={toolCall}
              className="tool-card"
              isUpdate={updateIndices.has(index)}
              hideIcon
            />
          ))}
        </div>
      )}
    </div>
  );
});
