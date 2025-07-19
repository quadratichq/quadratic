import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type MoveSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.MoveSheet]['responseSchema']>;

type MoveSheetProps = {
  args: string;
  loading: boolean;
};

export const MoveSheet = memo(({ args, loading }: MoveSheetProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<MoveSheetResponse, MoveSheetResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.MoveSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[MoveSheet] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Reorder sheet';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return (
    <ToolCard
      icon={icon}
      label={label}
      description={`"${toolArgs.data.sheet_name}" ${toolArgs.data.insert_before_sheet_name ? `moved before "${toolArgs.data.insert_before_sheet_name}"` : 'moved to the end of the list'}`}
    />
  );
});
