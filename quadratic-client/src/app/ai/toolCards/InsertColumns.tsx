import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type InsertColumnsResponse = z.infer<(typeof aiToolsSpec)[AITool.InsertColumns]['responseSchema']>;

type InsertColumnsProps = {
  args: string;
  loading: boolean;
};

export const InsertColumns = memo(({ args, loading }: InsertColumnsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<InsertColumnsResponse, InsertColumnsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.InsertColumns].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[InsertColumns] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Insert columns';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const description = `${toolArgs.data.count} columns have been inserted in sheet "${toolArgs.data.sheet_name}" at column "${toolArgs.data.column}".`;

  return <ToolCard icon={icon} label={label} description={description} />;
});
