import { getRowColSentence, ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

type AddDataTableResponse = z.infer<(typeof aiToolsSpec)[AITool.AddDataTable]['responseSchema']>;

type AddDataTableProps = {
  args: string;
  loading: boolean;
};

export const AddDataTable = ({ args, loading }: AddDataTableProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<AddDataTableResponse, AddDataTableResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.AddDataTable].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[AddDataTable] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <TableIcon />;
  const label = 'Data Table';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const { top_left_position, table_name, table_data } = toolArgs.data;
  const rows = table_data.length;
  const cols = table_data.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    <ToolCard
      icon={icon}
      label={`${label} - ${table_name}`}
      description={`${getRowColSentence({ rows, cols })} at ${top_left_position}`}
    />
  );
};
