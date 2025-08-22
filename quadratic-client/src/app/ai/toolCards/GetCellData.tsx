import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type GetCellDataResponse = z.infer<(typeof aiToolsSpec)[AITool.GetCellData]['responseSchema']>;

export const GetCellData = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<GetCellDataResponse, GetCellDataResponse>>();

    useEffect(() => {
      if (!loading) {
        try {
          const json = JSON.parse(args);
          setToolArgs(aiToolsSpec[AITool.GetCellData].responseSchema.safeParse(json));
        } catch (error) {
          setToolArgs(undefined);
          console.error('[GetCellData] Failed to parse args: ', error);
        }
      } else {
        setToolArgs(undefined);
      }
    }, [args, loading]);

    let label =
      toolArgs?.data?.sheet_name && toolArgs?.data?.selection
        ? `Reading data in ${toolArgs.data.sheet_name} from ${toolArgs.data.selection}`
        : 'Reading data...';
    if (toolArgs?.data?.page) {
      label += ` in page ${toolArgs.data.page + 1}`;
    }
    label += '.';
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
