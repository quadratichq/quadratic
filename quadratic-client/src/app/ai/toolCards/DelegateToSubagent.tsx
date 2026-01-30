import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { SearchIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DelegateToSubagentArgs = AIToolsArgs[AITool.DelegateToSubagent];

const SUBAGENT_LABELS: Record<string, string> = {
  data_finder: 'Searching for data',
};

export const DelegateToSubagent = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    type ParseResult = z.SafeParseReturnType<DelegateToSubagentArgs, DelegateToSubagentArgs>;
    const [toolArgs, setToolArgs] = useState<ParseResult>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.DelegateToSubagent].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[DelegateToSubagent] Failed to parse args:', error);
      }
    }, [args, loading]);

    const subagentType = toolArgs?.success ? toolArgs.data.subagent_type : undefined;
    const task = toolArgs?.success ? toolArgs.data.task : undefined;
    const label = subagentType ? (SUBAGENT_LABELS[subagentType] ?? 'Searching') : 'Searching';

    // Truncate task if too long
    const maxTaskLength = 60;
    const truncatedTask = task && task.length > maxTaskLength ? `${task.slice(0, maxTaskLength)}...` : task;

    return (
      <ToolCard
        icon={<SearchIcon />}
        label={label}
        description={truncatedTask}
        isLoading={loading}
        hasError={toolArgs && !toolArgs.success}
        className={className}
      />
    );
  }
);
