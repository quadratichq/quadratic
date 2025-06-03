//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { SearchIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type z from 'zod';
import { ToolCard } from './ToolCard';

type WebSearchResponse = z.infer<(typeof aiToolsSpec)[AITool.WebSearch]['responseSchema']>;

type WebSearchProps = {
  args: string;
  loading: boolean;
};

export const WebSearch = memo(({ args, loading }: WebSearchProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<WebSearchResponse, WebSearchResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.WebSearch].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[WebSearch] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <SearchIcon />;
  const label = 'Action: Web search';

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
