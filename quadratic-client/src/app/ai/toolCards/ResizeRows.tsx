import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type ResizeRowsResponse = z.infer<(typeof aiToolsSpec)[AITool.ResizeRows]['responseSchema']>;

type ResizeRowsProps = {
  args: string;
  loading: boolean;
};

export const ResizeRows = memo(({ args, loading }: ResizeRowsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ResizeRowsResponse, ResizeRowsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.ResizeRows].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ResizeRows] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Resize rows';

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
      ? `Rows in sheet "${toolArgs.data.sheet_name}" within selection "${toolArgs.data.selection}" have been resized.`
      : toolArgs.data.sheet_name && !toolArgs.data.selection
        ? `Rows in sheet "${toolArgs.data.sheet_name}" have been resized.`
        : 'Rows in all sheets have been resized.';

  return <ToolCard icon={icon} label={label} description={description} />;
});
