import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type DuplicateSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.DuplicateSheet]['responseSchema']>;

type DuplicateSheetProps = {
  args: string;
  loading: boolean;
};

export const DuplicateSheet = memo(({ args, loading }: DuplicateSheetProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<DuplicateSheetResponse, DuplicateSheetResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.DuplicateSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[DuplicateSheet] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Duplicate sheet';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return (
    <ToolCard
      icon={icon}
      label={label}
      description={`${toolArgs.data.name_of_new_sheet} (before ${toolArgs.data.sheet_name_to_duplicate})`}
    />
  );
});
