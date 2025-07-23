import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type InsertRowsResponse = z.infer<(typeof aiToolsSpec)[AITool.InsertRows]['responseSchema']>;

type InsertRowsProps = {
  args: string;
  loading: boolean;
};

export const InsertRows = memo(({ args, loading }: InsertRowsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<InsertRowsResponse, InsertRowsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.InsertRows].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[InsertRows] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Insert rows';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const description = `${toolArgs.data.count} rows have been inserted in sheet "${toolArgs.data.sheet_name}" at row "${toolArgs.data.row}".`;

  return <ToolCard icon={icon} label={label} description={description} />;
});
