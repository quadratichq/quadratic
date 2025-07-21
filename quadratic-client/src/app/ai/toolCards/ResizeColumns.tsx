import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type ResizeColumnsResponse = z.infer<(typeof aiToolsSpec)[AITool.ResizeColumns]['responseSchema']>;

type ResizeColumnsProps = {
  args: string;
  loading: boolean;
};

export const ResizeColumns = memo(({ args, loading }: ResizeColumnsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ResizeColumnsResponse, ResizeColumnsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.ResizeColumns].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ResizeColumns] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Resize columns';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const description =
    toolArgs.data.sheet_name && toolArgs.data.selection
      ? `Columns in sheet "${toolArgs.data.sheet_name}" within selection "${toolArgs.data.selection}" have been resized.`
      : toolArgs.data.sheet_name && !toolArgs.data.selection
        ? `Columns in sheet "${toolArgs.data.sheet_name}" have been resized.`
        : 'Columns in all sheets have been resized.';

  return <ToolCard icon={icon} label={label} description={description} />;
});
