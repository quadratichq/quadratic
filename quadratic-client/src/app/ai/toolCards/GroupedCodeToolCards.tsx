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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const label = useMemo(() => {
    const verb = isLoading ? 'Writing' : 'Wrote';
    const count = toolCalls.length;
    const fileText = count === 1 ? 'file' : 'files';
    const sheetText = sheetInfo ? ` in ${sheetInfo}` : '';
    return `${verb} ${count} code ${fileText}${sheetText}`;
  }, [isLoading, toolCalls.length, sheetInfo]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 text-[13px] text-foreground hover:text-foreground/80"
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
        <div className="mt-2 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
          {toolCalls.map((toolCall, index) => (
            <AIToolCard key={`${index}-${toolCall.id}-${toolCall.name}`} toolCall={toolCall} className="tool-card" />
          ))}
        </div>
      )}
    </div>
  );
});
