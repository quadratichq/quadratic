import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { useEffect, useState } from 'react';
import { z } from 'zod';

type DeleteCellsResponse = z.infer<(typeof aiToolsSpec)[AITool.DeleteCells]['responseSchema']>;

type DeleteCellsProps = {
  args: string;
  loading: boolean;
};

const className =
  'mx-2 my-1 flex items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow';

export const DeleteCells = ({ args, loading }: DeleteCellsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DeleteCellsResponse, DeleteCellsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.DeleteCells].responseSchema.safeParse(json));
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

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="font-bold">{`Delete rects: ${toolArgs.data.rects.length}`}</span>
      </div>
    </div>
  );
};
