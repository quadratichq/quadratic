import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DeleteCellsResponse = z.infer<(typeof aiToolsSpec)[AITool.DeleteCells]['responseSchema']>;

type DeleteCellsProps = {
  args: string;
  loading: boolean;
};

export const DeleteCells = memo(({ args, loading }: DeleteCellsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DeleteCellsResponse, DeleteCellsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.DeleteCells].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[MoveCells] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Action: delete';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return <ToolCard icon={icon} label={label} description={`${toolArgs.data.selection}`} />;
});
