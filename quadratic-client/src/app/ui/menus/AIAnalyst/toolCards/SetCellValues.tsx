import { getRowColSentence, ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

type SetCellValuesResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCellValues]['responseSchema']>;

type SetCellValuesProps = {
  args: string;
  loading: boolean;
};

export const SetCellValues = ({ args, loading }: SetCellValuesProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCellValuesResponse, SetCellValuesResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetCellValues].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetCodeCellValue] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <TableIcon />;
  const label = 'Data';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const { top_left_position, cell_values } = toolArgs.data;
  const rows = cell_values.length;
  const cols = cell_values.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    <ToolCard icon={icon} label={label} description={`${getRowColSentence({ rows, cols })} at ${top_left_position}`} />
  );
};
