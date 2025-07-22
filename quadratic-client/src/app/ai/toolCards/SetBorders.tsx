import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type SetBordersResponse = z.infer<(typeof aiToolsSpec)[AITool.SetBorders]['responseSchema']>;

type SetBordersProps = {
  args: string;
  loading: boolean;
};

export const SetBorders = memo(({ args, loading }: SetBordersProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetBordersResponse, SetBordersResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.SetBorders].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetBorders] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Set borders';

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
      ? `Borders in sheet "${toolArgs.data.sheet_name}" within selection "${toolArgs.data.selection}" have been set.`
      : toolArgs.data.sheet_name && !toolArgs.data.selection
        ? `Borders in sheet "${toolArgs.data.sheet_name}" have been set.`
        : 'Borders in all sheets have been set.';

  return <ToolCard icon={icon} label={label} description={description} />;
});
