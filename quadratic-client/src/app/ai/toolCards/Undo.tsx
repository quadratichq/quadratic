import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type UndoResponse = AIToolsArgs[AITool.Undo];

export const Undo = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<UndoResponse, UndoResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.Undo].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[Undo] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = loading ? 'Undoing' : 'Undone';

    const description = useMemo(() => {
      if (toolArgs?.success) {
        return `${toolArgs.data.count ?? 1} transactions undone`;
      }
      return '';
    }, [toolArgs?.data?.count, toolArgs?.success]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
