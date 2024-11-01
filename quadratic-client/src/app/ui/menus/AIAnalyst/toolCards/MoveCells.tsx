import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { getRowColSentence, ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { useEffect, useState } from 'react';
import { z } from 'zod';

type MoveCellsResponse = z.infer<(typeof aiToolsSpec)[AITool.MoveCells]['responseSchema']>;

type MoveCellsProps = {
  args: string;
  loading: boolean;
};

const className =
  'mx-2 my-1 flex items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow';

export const MoveCells = ({ args, loading }: MoveCellsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<MoveCellsResponse, MoveCellsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.MoveCells].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[MoveCells] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Action: move';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const rows = toolArgs.data.source_bottom_right_y - toolArgs.data.source_top_left_y + 1;
  const cols = toolArgs.data.source_bottom_right_x - toolArgs.data.source_top_left_x + 1;
  return (
    <ToolCard
      icon={icon}
      label={label}
      description={
        getRowColSentence({ rows, cols }) +
        ` from (${toolArgs.data.source_top_left_x}, ${toolArgs.data.source_top_left_y})` +
        ` to (${toolArgs.data.target_top_left_x}, ${toolArgs.data.target_top_left_y})`
        // toolArgs.data.source_top_left_x === toolArgs.data.source_bottom_right_x &&
        // toolArgs.data.source_top_left_y === toolArgs.data.source_bottom_right_y
        //   ? `1 cell`
        //   : `${rows}×${cols} cells`
        // ? `Cell (${toolArgs.data.sourceTopLeftX}, ${toolArgs.data.sourceTopLeftY}) moved to (${toolArgs.data.targetTopLeftX}, ${toolArgs.data.targetTopLeftY})`
        // : `Cells ((${toolArgs.data.sourceTopLeftX}, ${toolArgs.data.sourceTopLeftY}), (${toolArgs.data.sourceBottomRightX}, ${toolArgs.data.sourceBottomRightY})) moved to (${toolArgs.data.targetTopLeftX}, ${toolArgs.data.targetTopLeftY})`
      }
    />
  );
};
