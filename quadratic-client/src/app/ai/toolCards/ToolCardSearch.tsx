//! Used to add a query to the AI (similar to a tool call, but will not change
//! the state of the grid).

import { SearchIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type z from 'zod';

type SearchRequest = z.infer<(typeof aiToolsSpec)[AITool.Search]['parameters']['properties']['query']>;
type SearchResponse = z.infer<(typeof aiToolsSpec)[AITool.Search]['responseSchema']>;

type SearchProps = {
  args: string;
  loading: boolean;
};

export const ToolCardSearch = memo(
  ({
    args,
    hasError,
    className,
    isLoading,
  }: {
    args: string;
    hasError?: boolean;
    className?: string;
    isLoading?: boolean;
  }) => {
    const [toolArgs, setToolArgs] = useState<string>();

    useEffect(() => {
      if (!isLoading) {
        try {
          const json = JSON.parse(args);
          const query = json?.query;
          setToolArgs(query);
        } catch (error) {
          setToolArgs(undefined);
          console.error('[ToolCardSearch] Failed to parse args: ', error);
        }
      } else {
        setToolArgs(undefined);
      }
    }, [args, isLoading]);

    return (
      <div className={className}>
        <div
          className={cn(
            'flex items-center text-sm text-muted-foreground',
            isLoading &&
              // Black shimmer (better for readability)
              'bg-[linear-gradient(to_left,hsl(var(--foreground))_0%,hsl(var(--muted-foreground))_10%,hsl(var(--muted-foreground))_90%,hsl(var(--foreground))_100%)]',
            // White shimmer
            // 'bg-[linear-gradient(to_left,hsl(var(--muted-foreground)/0)_0%,hsl(var(--muted-foreground))_20%,hsl(var(--muted-foreground))_80%,hsl(var(--muted-foreground)/0)_100%)]',
            isLoading && 'animate-shimmer bg-[length:200%_100%] bg-clip-text text-transparent'
          )}
        >
          <SearchIcon className="mr-1 scale-75 text-muted-foreground" />
          {toolArgs}
        </div>
        {hasError && <p className="pl-6 text-xs text-destructive">Something went wrong (try again)</p>}
      </div>
    );
  }
);

export function getRowColSentence({ rows, cols }: { rows: number; cols: number }) {
  if (rows === 1 && cols === 1) {
    return '1 cell';
  }

  return `${rows} row${rows === 1 ? '' : 's'} × ${cols} col${cols === 1 ? '' : 's'}`;
}
