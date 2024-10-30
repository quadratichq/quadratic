import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
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

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="font-bold">{`Values ${toolArgs.data.values.length} x ${
          toolArgs.data.values[0]?.length ?? 0
        } set for (${toolArgs.data.x}, ${toolArgs.data.y})`}</span>
      </div>
    </div>
  );
};
