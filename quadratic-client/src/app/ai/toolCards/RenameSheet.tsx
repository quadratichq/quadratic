import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type RenameSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.RenameSheet]['responseSchema']>;

type RenameSheetProps = {
  args: string;
  loading: boolean;
};

export const RenameSheet = memo(({ args, loading }: RenameSheetProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<RenameSheetResponse, RenameSheetResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.RenameSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[RenameSheet] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Rename sheet';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return (
    <ToolCard icon={icon} label={label} description={`"${toolArgs.data.sheet_name}" -> "${toolArgs.data.new_name}"`} />
  );
});
