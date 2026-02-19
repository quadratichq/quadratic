import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type GetCellDataResponse = AIToolsArgs[AITool.GetCellData];

export const GetCellData = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<GetCellDataResponse, GetCellDataResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.GetCellData].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[GetCellData] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const label = useMemo(() => {
      const verb = loading ? 'Reading' : 'Read';
      return (
        (toolArgs?.data?.sheet_name && toolArgs?.data?.selection
          ? `${verb} data in ${toolArgs.data.sheet_name} from ${toolArgs.data.selection}`
          : `${verb} data...`) +
        (toolArgs?.data?.page ? ` in page ${toolArgs.data.page + 1}` : '') +
        '.'
      );
    }, [toolArgs?.data?.sheet_name, toolArgs?.data?.selection, toolArgs?.data?.page, loading]);

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
