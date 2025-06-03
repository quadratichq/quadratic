//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { SearchIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type z from 'zod';
import { ToolCard } from './ToolCard';

type SourcesResponse = z.infer<(typeof aiToolsSpec)[AITool.Sources]['responseSchema']>;

type SourcesProps = {
  args: string;
  loading: boolean;
};

export const Sources = memo(({ args, loading }: SourcesProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SourcesResponse, SourcesResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        console.log('json', json);
        setToolArgs(aiToolsSpec[AITool.Sources].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[Sources] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <SearchIcon />;
  const label = 'Action: Sources';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return <ToolCard icon={icon} label={label} />;
});
