import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { GridDataIcon } from '@/shared/components/Icons';
import { useEffect, useState } from 'react';
import { z } from 'zod';

type SetCellValuesResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCellValues]['responseSchema']>;

type SetCellValuesProps = {
  args: string;
  loading: boolean;
};

const className =
  'mx-2 my-1 flex items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow';

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

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <span className="font-bold">{`Loading values...`}</span>
        </div>
      </div>
    );
  }

  if (!!toolArgs && !toolArgs.success) {
    return <div className={className}>Something went wrong</div>;
  } else if (!toolArgs || !toolArgs.data) {
    return <div className={className}>Loading...</div>;
  }

  const { x, y, values } = toolArgs.data;
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  return (
    <ToolCard
      icon={<GridDataIcon />}
      label={'Data'}
      description={`${rows === 1 && cols === 1 ? '1 cell' : `${rows}×${cols} cells`} at (${x}, ${y})`}
    />
  );
};
