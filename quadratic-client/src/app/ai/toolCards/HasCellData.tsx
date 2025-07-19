import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type HasCellDataResponse = z.infer<(typeof aiToolsSpec)[AITool.HasCellData]['responseSchema']>;

type HasCellDataProps = {
  args: string;
  loading: boolean;
};

export const HasCellData = memo(({ args, loading }: HasCellDataProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<HasCellDataResponse, HasCellDataResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.HasCellData].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[HasCellData] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const label =
    toolArgs?.data?.sheet_name && toolArgs?.data?.selection
      ? `Checking empty space in ${toolArgs.data.sheet_name} for ${toolArgs.data.selection}`
      : 'Checking empty space...';

  if (loading) {
    return <ToolCardQuery label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCardQuery label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCardQuery label={label} isLoading />;
  }

  return <ToolCardQuery label={label} />;
});
