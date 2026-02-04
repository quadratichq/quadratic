//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type z from 'zod';

type WebSearchResponse = AIToolsArgs[AITool.WebSearch];

export const WebSearch = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<WebSearchResponse, WebSearchResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.WebSearch].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[WebSearch] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const label = 'Searching the web.';

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCardQuery label={label} hasError className={className} />;
    }

    return null;
  }
);
