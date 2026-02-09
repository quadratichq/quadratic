import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { GridActionIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';

type MoveCellsResponse = AIToolsArgs[AITool.MoveCells];

interface MoveItem {
  source_selection_rect: string;
  target_top_left_position: string;
}

export const MoveCells = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<MoveCellsResponse, MoveCellsResponse>>();
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.MoveCells].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[MoveCells] Failed to parse args: ', error);
      }
    }, [args, loading]);

    // Get all moves (from either new or old format)
    const getMoves = useCallback((): MoveItem[] => {
      if (!toolArgs?.success) return [];

      // New format: moves array
      if (toolArgs.data.moves && toolArgs.data.moves.length > 0) {
        return toolArgs.data.moves;
      }

      // Old format: source_selection_rect and target_top_left_position
      if (toolArgs.data.source_selection_rect && toolArgs.data.target_top_left_position) {
        return [
          {
            source_selection_rect: toolArgs.data.source_selection_rect,
            target_top_left_position: toolArgs.data.target_top_left_position,
          },
        ];
      }

      return [];
    }, [toolArgs]);

    const handleMoveClick = useCallback((move: MoveItem, sheetName?: string | null) => {
      try {
        const sheetId = sheetName ? (sheets.getSheetByName(sheetName)?.id ?? sheets.current) : sheets.current;
        const selection = sheets.stringToSelection(move.target_top_left_position, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, []);

    const handleClick = useCallback(() => {
      const moves = getMoves();
      if (moves.length > 0) {
        handleMoveClick(moves[0], toolArgs?.data?.sheet_name);
      }
    }, [getMoves, handleMoveClick, toolArgs?.data?.sheet_name]);

    const icon = <GridActionIcon />;
    const moves = getMoves();
    const moveCount = moves.length;
    const label = loading ? 'Moving cells' : moveCount > 1 ? `Moved ${moveCount} selections` : 'Moved cells';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    // Single move: show inline
    if (moves.length === 1) {
      const move = moves[0];
      return (
        <ToolCard
          icon={icon}
          label={label}
          description={`"${move.source_selection_rect}" → "${move.target_top_left_position}"`}
          className={className}
          compact
          onClick={handleClick}
        />
      );
    }

    // Multiple moves: show collapsed view with expand/collapse
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <GridActionIcon />
          <span>{label}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (
          <div className="ml-[7px] mt-1 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
            {moves.map((move, index) => (
              <div
                key={index}
                className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
                onClick={() => handleMoveClick(move, toolArgs.data?.sheet_name)}
              >
                <span className="min-w-0 truncate">
                  {move.source_selection_rect} → {move.target_top_left_position}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
