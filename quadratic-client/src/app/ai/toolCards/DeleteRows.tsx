import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DeleteRowsResponse = z.infer<(typeof aiToolsSpec)[AITool.DeleteRows]['responseSchema']>;

type DeleteRowsProps = {
  args: string;
  loading: boolean;
};

export const DeleteRows = memo(({ args, loading }: DeleteRowsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DeleteRowsResponse, DeleteRowsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.DeleteRows].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[DeleteRows] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Delete rows';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const description = `Rows ${toolArgs.data.rows.join(', ')} have been deleted in sheet "${toolArgs.data.sheet_name}".`;

  return <ToolCard icon={icon} label={label} description={description} />;
});
