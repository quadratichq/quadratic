import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type GetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.GetCodeCellValue]['responseSchema']>;

export const GetCodeCellValue = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<GetCodeCellValueResponse, GetCodeCellValueResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.GetCodeCellValue].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[GetCodeCellValue] Failed to parse args: ', error);
      }
    }, [args, loading]);

    let label = useMemo(
      () =>
        `Reading code cell ${toolArgs?.data?.sheet_name ? `in ${toolArgs?.data?.sheet_name}` : ''} from ${toolArgs?.data?.code_cell_name ?? toolArgs?.data?.code_cell_position}.`,
      [toolArgs?.data?.sheet_name, toolArgs?.data?.code_cell_name, toolArgs?.data?.code_cell_position]
    );

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
