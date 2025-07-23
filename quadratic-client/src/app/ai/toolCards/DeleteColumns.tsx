import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DeleteColumnsResponse = z.infer<(typeof aiToolsSpec)[AITool.DeleteColumns]['responseSchema']>;

type DeleteColumnsProps = {
  args: string;
  loading: boolean;
};

export const DeleteColumns = memo(({ args, loading }: DeleteColumnsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DeleteColumnsResponse, DeleteColumnsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.DeleteColumns].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[DeleteColumns] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Delete columns';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const description = `Columns ${toolArgs.data.columns.join(', ')} have been deleted in sheet "${toolArgs.data.sheet_name}".`;

  return <ToolCard icon={icon} label={label} description={description} />;
});
