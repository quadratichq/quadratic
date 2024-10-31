import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
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

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <span className="font-bold">{`Loading...`}</span>
        </div>
      </div>
    );
  }

  if (!!toolArgs && !toolArgs.success) {
    return <div className={className}>Something went wrong</div>;
  } else if (!toolArgs || !toolArgs.data) {
    return <div className={className}>Loading...</div>;
  }

  const rows = toolArgs.data.sourceBottomRightY - toolArgs.data.sourceTopLeftY + 1;
  const cols = toolArgs.data.sourceBottomRightX - toolArgs.data.sourceTopLeftX + 1;
  return (
    <ToolCard
      icon={<GridActionIcon />}
      label="Action: move"
      description={
        toolArgs.data.sourceTopLeftX === toolArgs.data.sourceBottomRightX &&
        toolArgs.data.sourceTopLeftY === toolArgs.data.sourceBottomRightY
          ? `1 cell`
          : `${rows}x${cols} cells`
        // ? `Cell (${toolArgs.data.sourceTopLeftX}, ${toolArgs.data.sourceTopLeftY}) moved to (${toolArgs.data.targetTopLeftX}, ${toolArgs.data.targetTopLeftY})`
        // : `Cells ((${toolArgs.data.sourceTopLeftX}, ${toolArgs.data.sourceTopLeftY}), (${toolArgs.data.sourceBottomRightX}, ${toolArgs.data.sourceBottomRightY})) moved to (${toolArgs.data.targetTopLeftX}, ${toolArgs.data.targetTopLeftY})`
      }
    />
  );
};
