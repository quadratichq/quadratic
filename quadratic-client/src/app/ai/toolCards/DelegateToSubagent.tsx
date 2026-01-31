import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DelegateToSubagentArgs = AIToolsArgs[AITool.DelegateToSubagent];

export const DelegateToSubagent = memo(
  ({ toolCall: { id, arguments: args, loading } }: { toolCall: AIToolCall; className: string }) => {
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
    const contextHints = toolArgs?.success ? toolArgs.data.context_hints : undefined;
    const hasError = toolArgs && !toolArgs.success;

    return (
      <div className="my-1 rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Subagent:</span>
          <span>{subagentType ?? (loading ? 'loading...' : 'unknown')}</span>
          {loading && <span className="animate-pulse text-yellow-600">(running)</span>}
          {!loading && !hasError && <span className="text-green-600">(done)</span>}
          {hasError && <span className="text-destructive">(error)</span>}
        </div>
        {task && (
          <div className="mt-0.5">
            <span className="font-semibold text-foreground">Task:</span> {task}
          </div>
        )}
        {contextHints && (
          <div className="mt-0.5">
            <span className="font-semibold text-foreground">Hints:</span> {contextHints}
          </div>
        )}
        <div className="mt-0.5 text-[10px] opacity-60">id: {id}</div>
      </div>
    );
  }
);
