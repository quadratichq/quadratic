import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type TextSearchResponse = z.infer<(typeof aiToolsSpec)[AITool.TextSearch]['responseSchema']>;

type TextSearchProps = {
  args: string;
  loading: boolean;
};

export const TextSearch = memo(({ args, loading }: TextSearchProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<TextSearchResponse, TextSearchResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.TextSearch].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[TextSearch] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Text search';

  if (loading) {
    return <ToolCardQuery label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return <ToolCard icon={icon} label={label} description={`Searched "${toolArgs.data.query}".`} />;
});
