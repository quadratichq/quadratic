import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DeleteSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.DeleteSheet]['responseSchema']>;

type DeleteSheetProps = {
  args: string;
  loading: boolean;
};

export const DeleteSheet = memo(({ args, loading }: DeleteSheetProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DeleteSheetResponse, DeleteSheetResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.DeleteSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[DeleteSheet] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Delete sheet';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return <ToolCard icon={icon} label={label} description={`${toolArgs.data.sheet_name}`} />;
});
