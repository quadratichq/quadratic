import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type HasCellDataResponse = z.infer<(typeof aiToolsSpec)[AITool.HasCellData]['responseSchema']>;

export const HasCellData = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<HasCellDataResponse, HasCellDataResponse>>();

    useEffect(() => {
      if (!loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.HasCellData].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[HasCellData] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const label = useMemo(
      () =>
        toolArgs?.data?.sheet_name && toolArgs?.data?.selection
          ? `Checking empty space in ${toolArgs.data.sheet_name} for ${toolArgs.data.selection}`
          : 'Checking empty space...',
      [toolArgs?.data?.selection, toolArgs?.data?.sheet_name]
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
