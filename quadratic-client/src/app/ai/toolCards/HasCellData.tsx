import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type HasCellDataResponse = AIToolsArgs[AITool.HasCellData];

export const HasCellData = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<HasCellDataResponse, HasCellDataResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.HasCellData].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[HasCellData] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const label = useMemo(() => {
      const verb = loading ? 'Checking' : 'Checked';
      return toolArgs?.data?.sheet_name && toolArgs?.data?.selection
        ? `${verb} empty space in ${toolArgs.data.sheet_name} for ${toolArgs.data.selection}`
        : `${verb} empty space...`;
    }, [toolArgs?.data?.selection, toolArgs?.data?.sheet_name, loading]);

    if (loading) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCardQuery label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    return <ToolCardQuery label={label} className={className} />;
  }
);
