import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type RerunCodeResponse = z.infer<(typeof aiToolsSpec)[AITool.RerunCode]['responseSchema']>;

type RerunCodeProps = {
  args: string;
  loading: boolean;
};

export const RerunCode = memo(({ args, loading }: RerunCodeProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<RerunCodeResponse, RerunCodeResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.RerunCode].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[RerunCode] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Rerun code';

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
      ? `Code in sheet "${toolArgs.data.sheet_name}" within selection "${toolArgs.data.selection}" has been rerun.`
      : toolArgs.data.sheet_name && !toolArgs.data.selection
        ? `Code in sheet "${toolArgs.data.sheet_name}" has been rerun.`
        : 'Code in all sheets has been rerun.';

  return <ToolCard icon={icon} label={label} description={description} />;
});
